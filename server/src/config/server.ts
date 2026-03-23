import { resolve } from "path";
import { existsSync } from "fs";

function validatePositiveInt(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    console.error(`[config] ${name} must be a positive integer, got: "${raw}"`);
    process.exit(1);
  }
  return n;
}

export const HMAC_TTL_SECONDS: number = validatePositiveInt("HMAC_TTL", process.env.HMAC_TTL, 3600);
export const SESSION_TTL_SECONDS: number = validatePositiveInt("SESSION_TTL", process.env.SESSION_TTL, 300);
export const RATE_LIMIT_RPM: number = validatePositiveInt("RATE_LIMIT_RPM", process.env.RATE_LIMIT_RPM, 60);
export const SERVER_PORT: number = validatePositiveInt("PORT", process.env.PORT, 3000);
export const PAGES_DIR: string = process.env.PAGES_DIR ?? resolve(import.meta.dir, "..", "..", "pages");

if (!existsSync(PAGES_DIR)) {
  console.error(`[config] PAGES_DIR does not exist: ${PAGES_DIR}`);
  process.exit(1);
}
