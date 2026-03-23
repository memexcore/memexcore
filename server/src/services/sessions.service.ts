import { db } from "../config/database";
import type { Session } from "../models/types";

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    pages TEXT NOT NULL,
    exp INTEGER NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions(exp)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`);

const stmtInsert = db.prepare(
  "INSERT INTO sessions (session_id, user_id, pages, exp, revoked) VALUES (?, ?, ?, ?, 0)"
);
const stmtGet = db.prepare("SELECT * FROM sessions WHERE session_id = ?");
const stmtRevoke = db.prepare("UPDATE sessions SET revoked = 1 WHERE session_id = ?");

interface SessionRow {
  session_id: string;
  user_id: string;
  pages: string;
  exp: number;
  revoked: number;
}

export function dbGetSession(sessionId: string): Session | null {
  const row = stmtGet.get(sessionId) as SessionRow | null;
  if (!row) return null;
  return {
    session_id: row.session_id,
    user_id: row.user_id,
    pages: JSON.parse(row.pages),
    exp: row.exp,
    revoked: row.revoked === 1,
  };
}

export function dbCreateSession(session: Session): void {
  stmtInsert.run(session.session_id, session.user_id, JSON.stringify(session.pages), session.exp);
}

export function dbRevokeSession(sessionId: string): boolean {
  const result = stmtRevoke.run(sessionId);
  return result.changes > 0;
}

setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  db.exec(`DELETE FROM sessions WHERE exp <= ${now}`);
}, 300_000);
