import { db } from "../config/database";
import { HMAC_TTL_SECONDS } from "../config/server";

db.exec(`
  CREATE TABLE IF NOT EXISTS hmac_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    secret TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`);

const stmtInsert = db.prepare("INSERT INTO hmac_keys (secret) VALUES (?)");
const stmtGetRecent = db.prepare(
  "SELECT secret FROM hmac_keys ORDER BY id DESC LIMIT 2"
);
const stmtCleanup = db.prepare("DELETE FROM hmac_keys WHERE created_at < ?");

interface HmacKeyRow {
  secret: string;
}

export function dbInsertHmacKey(secret: string): void {
  stmtInsert.run(secret);
}

export function dbGetRecentKeys(): { current: string; previous: string | null } | null {
  const rows = stmtGetRecent.all() as HmacKeyRow[];
  if (rows.length === 0) return null;
  return {
    current: rows[0].secret,
    previous: rows.length > 1 ? rows[1].secret : null,
  };
}

export function dbCleanupHmacKeys(): void {
  const cutoff = Math.floor(Date.now() / 1000) - HMAC_TTL_SECONDS * 2;
  stmtCleanup.run(cutoff);
}
