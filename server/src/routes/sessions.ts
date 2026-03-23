import { SESSION_TTL_SECONDS } from "../config/server";
import { dbCreateSession, dbGetSession, dbRevokeSession } from "../services/sessions.service";
import { signMessage } from "../middlewares/hmac.middleware";
import { errorResponse } from "../utils/errors";
import type { Session } from "../models/types";

export async function handleCreateSession(req: Request): Promise<Response> {
  const body = (await req.json()) as { user_id?: string; pages?: string[] };

  if (!body.user_id || !Array.isArray(body.pages) || body.pages.length === 0) {
    return errorResponse("invalid_request");
  }

  const session_id: string = crypto.randomUUID();
  const exp: number = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;

  const origin = new URL(req.url).origin;
  const context_urls: Record<string, string> = {};

  for (const page of body.pages) {
    const message = `${session_id}:${page}:${exp}`;
    const sig = await signMessage(message);
    context_urls[page] = `${origin}/context/${page}?sid=${session_id}&exp=${exp}&sig=${sig}`;
  }

  const session: Session = {
    session_id,
    user_id: body.user_id,
    pages: body.pages,
    exp,
    revoked: false,
  };

  dbCreateSession(session);

  return Response.json({ session_id, expires_at: exp, context_urls });
}

export function handleGetSession(sessionId: string): Response {
  const session = dbGetSession(sessionId);
  if (!session) {
    return errorResponse("session_not_found");
  }
  const now = Math.floor(Date.now() / 1000);
  return Response.json({
    session_id: session.session_id,
    user_id: session.user_id,
    pages: session.pages,
    expires_at: session.exp,
    revoked: session.revoked,
    expired: session.exp <= now,
  });
}

export function handleDeleteSession(sessionId: string): Response {
  const found = dbRevokeSession(sessionId);
  if (!found) {
    return errorResponse("session_not_found");
  }
  return Response.json({ ok: true, session_id: sessionId, revoked: true });
}
