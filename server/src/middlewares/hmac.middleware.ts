import { HMAC_TTL_SECONDS } from "../config/server";
import type { HmacKeyPair } from "../models/types";
import { dbInsertHmacKey, dbGetRecentKeys, dbCleanupHmacKeys } from "../services/hmacKeys.service";

function generateHmacSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function loadOrCreateKeys(): HmacKeyPair {
  const stored = dbGetRecentKeys();
  if (stored) {
    console.log(JSON.stringify({ ts: new Date().toISOString(), event: "hmac_keys_loaded_from_db" }));
    return { current: stored.current, previous: stored.previous };
  }
  const secret = generateHmacSecret();
  dbInsertHmacKey(secret);
  console.log(JSON.stringify({ ts: new Date().toISOString(), event: "hmac_key_created" }));
  return { current: secret, previous: null };
}

export const hmacKeys: HmacKeyPair = loadOrCreateKeys();

function rotateHmacSecret(): void {
  hmacKeys.previous = hmacKeys.current;
  hmacKeys.current = generateHmacSecret();
  dbInsertHmacKey(hmacKeys.current);
  dbCleanupHmacKeys();
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      event: "hmac_rotated",
      next_rotation_in: `${HMAC_TTL_SECONDS}s`,
    })
  );
}

setInterval(rotateHmacSecret, HMAC_TTL_SECONDS * 1000);

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function timingSafeVerify(key: CryptoKey, signatureHex: string, message: string): Promise<boolean> {
  const sigBytes = hexToBytes(signatureHex);
  if (!sigBytes) return false;

  const expectedSig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))
  );

  if (sigBytes.length !== expectedSig.length) return false;

  return crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(message));
}

export async function signMessage(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(hmacKeys.current),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Buffer.from(signature).toString("hex");
}

export async function verifySignature(message: string, signatureHex: string): Promise<boolean> {
  const primaryKey = await importHmacKey(hmacKeys.current);
  if (await timingSafeVerify(primaryKey, signatureHex, message)) {
    return true;
  }

  if (hmacKeys.previous) {
    const prevKey = await importHmacKey(hmacKeys.previous);
    if (await timingSafeVerify(prevKey, signatureHex, message)) {
      return true;
    }
  }

  return false;
}
