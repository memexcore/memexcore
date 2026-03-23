import { handleCreateSession, handleGetSession, handleDeleteSession } from "./routes/sessions";
import { handleContextPage } from "./routes/context";
import { handleHealth } from "./routes/health";
import { errorResponse } from "./utils/errors";
import { SERVER_PORT, HMAC_TTL_SECONDS, SESSION_TTL_SECONDS, RATE_LIMIT_RPM, PAGES_DIR } from "./config/server";
import { DB_PATH } from "./config/db";

console.log(JSON.stringify({
  ts: new Date().toISOString(),
  event: "config_loaded",
  port: SERVER_PORT,
  session_ttl: SESSION_TTL_SECONDS,
  hmac_ttl: HMAC_TTL_SECONDS,
  rate_limit_rpm: RATE_LIMIT_RPM,
  pages_dir: PAGES_DIR,
  db_path: DB_PATH,
}));

const server = Bun.serve({
  port: SERVER_PORT,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const { pathname } = url;

    if (req.method === "GET" && pathname === "/health") {
      return handleHealth();
    }

    if (req.method === "POST" && pathname === "/session") {
      return handleCreateSession(req);
    }

    if (req.method === "GET" && pathname.startsWith("/context/")) {
      const pageId = pathname.slice("/context/".length);
      return handleContextPage(req, pageId);
    }

    if (req.method === "GET" && pathname.startsWith("/session/")) {
      const sessionId = pathname.slice("/session/".length);
      return handleGetSession(sessionId);
    }

    if (req.method === "DELETE" && pathname.startsWith("/session/")) {
      const sessionId = pathname.slice("/session/".length);
      return handleDeleteSession(sessionId);
    }

    return errorResponse("not_found");
  },
});

console.log(`[Context Pages] Running on http://localhost:${server.port}`);
