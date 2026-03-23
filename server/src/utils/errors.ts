export type ErrorCode =
  | "token_expired"
  | "invalid_signature"
  | "session_revoked"
  | "session_not_found"
  | "page_not_found"
  | "invalid_request"
  | "rate_limited"
  | "not_found";

const ERROR_MAP: Record<ErrorCode, { status: number; message: string }> = {
  token_expired:     { status: 401, message: "The session token has expired" },
  invalid_signature: { status: 401, message: "The request signature is invalid" },
  session_revoked:   { status: 403, message: "The session has been revoked" },
  session_not_found: { status: 404, message: "Session not found" },
  page_not_found:    { status: 404, message: "The requested page does not exist" },
  invalid_request:   { status: 400, message: "The request is missing required parameters" },
  rate_limited:      { status: 429, message: "Too many requests, try again later" },
  not_found:         { status: 404, message: "The requested resource does not exist" },
};

export function errorResponse(code: ErrorCode, headers?: Record<string, string>): Response {
  const { status, message } = ERROR_MAP[code];
  return Response.json(
    { error: { code, message } },
    { status, ...(headers ? { headers } : {}) },
  );
}
