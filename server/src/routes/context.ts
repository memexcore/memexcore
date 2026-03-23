import { resolve } from "path";
import { PAGES_DIR, RATE_LIMIT_RPM } from "../config/server";
import { verifySignature } from "../middlewares/hmac.middleware";
import { dbGetSession } from "../services/sessions.service";
import { errorResponse } from "../utils/errors";
import type { ErrorCode } from "../utils/errors";

// --- Rate limiter ---

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap: Map<string, RateLimitEntry> = new Map();

function checkRateLimit(sessionId: string): { allowed: true } | { allowed: false; retryAfter: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(sessionId);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(sessionId, { count: 1, resetAt: now + 60_000 });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT_RPM) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now >= entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 60_000);

// --- Audit log ---

type AuditEvent = "page_read" | ErrorCode;

function auditLog(event: AuditEvent, sessionId: string | null, pageId: string, ip: string, sig?: string | null): void {
  const entry: Record<string, string> = {
    ts: new Date().toISOString(),
    event,
    session_id: sessionId ?? "",
    page_id: pageId,
    ip,
    result: event === "page_read" ? "ok" : event,
  };
  if (sig) {
    entry.sig_prefix = sig.substring(0, 8);
  }
  console.log(JSON.stringify(entry));
}

// --- Security headers (applied to successful page responses) ---

const SECURITY_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'",
  "Referrer-Policy": "no-referrer",
};

// --- Validation ---

async function validateRequest(
  pageId: string,
  url: URL
): Promise<{ valid: true; sid: string } | { valid: false; code: ErrorCode }> {
  const sid = url.searchParams.get("sid");
  const exp = url.searchParams.get("exp");
  const sig = url.searchParams.get("sig");

  if (!sid || !exp || !sig) {
    return { valid: false, code: "invalid_request" };
  }

  const expNum = Number(exp);
  const now = Math.floor(Date.now() / 1000);

  if (expNum <= now) {
    return { valid: false, code: "token_expired" };
  }

  const session = dbGetSession(sid);
  if (session?.revoked) {
    return { valid: false, code: "session_revoked" };
  }

  const message = `${sid}:${pageId}:${exp}`;
  const valid = await verifySignature(message, sig);

  if (!valid) {
    return { valid: false, code: "invalid_signature" };
  }

  return { valid: true, sid };
}

// --- Handler ---

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "127.0.0.1";
}

export async function handleContextPage(req: Request, pageId: string): Promise<Response> {
  const url = new URL(req.url);
  const ip = getClientIp(req);
  const sig = url.searchParams.get("sig");
  const sid = url.searchParams.get("sid");

  if (!pageId || pageId.includes("/") || pageId.includes("..")) {
    return errorResponse("invalid_request");
  }

  if (sid) {
    const rateCheck = checkRateLimit(sid);
    if (!rateCheck.allowed) {
      auditLog("rate_limited", sid, pageId, ip, sig);
      return errorResponse("rate_limited", { "Retry-After": String(rateCheck.retryAfter) });
    }
  }

  const validation = await validateRequest(pageId, url);

  if (!validation.valid) {
    auditLog(validation.code, sid, pageId, ip, sig);
    return errorResponse(validation.code);
  }

  const filePath = resolve(PAGES_DIR, `${pageId}.txt`);
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    auditLog("page_not_found", validation.sid, pageId, ip, sig);
    return errorResponse("page_not_found");
  }

  auditLog("page_read", validation.sid, pageId, ip, sig);
  const content = await file.text();
  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS },
  });
}
