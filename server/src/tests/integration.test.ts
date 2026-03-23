import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Subprocess } from "bun";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const TEST_PORT = 3999;
const BASE = `http://localhost:${TEST_PORT}`;

let serverProc: Subprocess;
let tmpDir: string;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "context-pages-test-"));
  const dbPath = join(tmpDir, "test.db");
  const pagesDir = join(tmpDir, "pages");
  mkdirSync(pagesDir);
  writeFileSync(join(pagesDir, "ventas.txt"), "Contenido de ventas");
  writeFileSync(join(pagesDir, "clientes.txt"), "Contenido de clientes");

  serverProc = Bun.spawn(["bun", "run", "src/index.ts"], {
    cwd: join(import.meta.dir, "..", ".."),
    env: {
      ...process.env,
      DB_PATH: dbPath,
      PORT: String(TEST_PORT),
      PAGES_DIR: pagesDir,
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  // Wait for server to be ready
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {}
    await Bun.sleep(100);
  }
  throw new Error("Server failed to start");
});

afterAll(() => {
  serverProc?.kill();
  try {
    rmSync(tmpDir, { recursive: true });
  } catch {}
});

// ── 404 Not Found (unknown route) ───────────────────────────────────────

describe("unknown routes", () => {
  test("GET unknown path returns not_found", async () => {
    const res = await fetch(`${BASE}/nonexistent`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("not_found");
  });

  test("POST unknown path returns not_found", async () => {
    const res = await fetch(`${BASE}/unknown`, { method: "POST" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("not_found");
  });

  test("wrong method on existing route returns not_found", async () => {
    const res = await fetch(`${BASE}/health`, { method: "POST" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("not_found");
  });
});

// ── POST /session — invalid_request ─────────────────────────────────────

describe("POST /session errors", () => {
  test("missing body fields returns invalid_request", async () => {
    const res = await fetch(`${BASE}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_request");
  });

  test("missing pages returns invalid_request", async () => {
    const res = await fetch(`${BASE}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: "u1" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_request");
  });

  test("empty pages array returns invalid_request", async () => {
    const res = await fetch(`${BASE}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: "u1", pages: [] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_request");
  });

  test("missing user_id returns invalid_request", async () => {
    const res = await fetch(`${BASE}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pages: ["ventas"] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_request");
  });
});

// ── GET /session/:id — session_not_found ────────────────────────────────

describe("GET /session/:id errors", () => {
  test("nonexistent session returns session_not_found", async () => {
    const res = await fetch(`${BASE}/session/00000000-0000-0000-0000-000000000000`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("session_not_found");
  });
});

// ── DELETE /session/:id — session_not_found ─────────────────────────────

describe("DELETE /session/:id errors", () => {
  test("nonexistent session returns session_not_found", async () => {
    const res = await fetch(`${BASE}/session/00000000-0000-0000-0000-000000000000`, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("session_not_found");
  });
});

// ── Session lifecycle (happy path) ──────────────────────────────────────

describe("session lifecycle", () => {
  let sessionId: string;
  let expiresAt: number;

  test("POST /session creates a session", async () => {
    const res = await fetch(`${BASE}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: "user-1", pages: ["ventas", "clientes"] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session_id).toBeString();
    expect(body.expires_at).toBeNumber();
    expect(body.context_urls.ventas).toBeString();
    expect(body.context_urls.clientes).toBeString();

    sessionId = body.session_id;
    expiresAt = body.expires_at;
  });

  test("GET /session/:id returns session details", async () => {
    const res = await fetch(`${BASE}/session/${sessionId}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session_id).toBe(sessionId);
    expect(body.user_id).toBe("user-1");
    expect(body.pages).toEqual(["ventas", "clientes"]);
    expect(body.expires_at).toBe(expiresAt);
    expect(body.revoked).toBe(false);
    expect(body.expired).toBe(false);
  });

  test("DELETE /session/:id revokes the session", async () => {
    const res = await fetch(`${BASE}/session/${sessionId}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.revoked).toBe(true);
    expect(body.session_id).toBe(sessionId);
  });

  test("GET /session/:id shows revoked after delete", async () => {
    const res = await fetch(`${BASE}/session/${sessionId}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revoked).toBe(true);
  });
});

// ── GET /context/:pageId — errors ───────────────────────────────────────

describe("GET /context/:pageId errors", () => {
  test("missing query params returns invalid_request", async () => {
    const res = await fetch(`${BASE}/context/ventas`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_request");
  });

  test("partial query params returns invalid_request", async () => {
    const res = await fetch(`${BASE}/context/ventas?sid=abc&exp=999`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_request");
  });

  test("path traversal returns invalid_request", async () => {
    const res = await fetch(`${BASE}/context/..%2Findex`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_request");
  });

  test("expired token returns token_expired", async () => {
    const res = await fetch(`${BASE}/context/ventas?sid=fake&exp=1000000000&sig=aabbccdd`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("token_expired");
  });

  test("revoked session returns session_revoked", async () => {
    // Create and revoke a session
    const create = await fetch(`${BASE}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: "u-revoke", pages: ["ventas"] }),
    });
    const { session_id, context_urls } = await create.json();
    await fetch(`${BASE}/session/${session_id}`, { method: "DELETE" });

    const res = await fetch(context_urls.ventas);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("session_revoked");
  });

  test("invalid signature returns invalid_signature", async () => {
    const exp = Math.floor(Date.now() / 1000) + 600;
    const res = await fetch(`${BASE}/context/ventas?sid=fake-sid&exp=${exp}&sig=deadbeef`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_signature");
  });

  test("nonexistent page returns page_not_found", async () => {
    // Create session with a page that doesn't have a file
    const create = await fetch(`${BASE}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: "u-nf", pages: ["noexiste"] }),
    });
    const { context_urls } = await create.json();

    const res = await fetch(context_urls.noexiste);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("page_not_found");
  });
});

// ── GET /context/:pageId — happy path ───────────────────────────────────

describe("GET /context/:pageId happy path", () => {
  test("returns page content with security headers", async () => {
    const create = await fetch(`${BASE}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: "u-read", pages: ["ventas"] }),
    });
    const { context_urls } = await create.json();

    const res = await fetch(context_urls.ventas);
    expect(res.status).toBe(200);

    const text = await res.text();
    expect(text).toBe("Contenido de ventas");

    expect(res.headers.get("Content-Type")).toContain("text/plain");
    expect(res.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  test("can read a second page from the same session", async () => {
    const create = await fetch(`${BASE}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: "u-multi", pages: ["ventas", "clientes"] }),
    });
    const { context_urls } = await create.json();

    const res1 = await fetch(context_urls.ventas);
    expect(res1.status).toBe(200);
    expect(await res1.text()).toBe("Contenido de ventas");

    const res2 = await fetch(context_urls.clientes);
    expect(res2.status).toBe(200);
    expect(await res2.text()).toBe("Contenido de clientes");
  });
});

// ── GET /health — happy path ────────────────────────────────────────────

describe("GET /health", () => {
  test("returns ok", async () => {
    const res = await fetch(`${BASE}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});