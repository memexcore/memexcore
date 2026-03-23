# Context Pages — Roadmap

> Guiding principle: each phase must be stable and secure before moving to the next.
> The project is open source — the public API of each phase is considered a contract.

---

## Phase 0 — MVP (complete)

Goal: functional proof of concept running locally.

- [x] Orchestrator with `POST /session` and `DELETE /session/:id`
- [x] Signed URLs with HMAC-SHA256 + session binding
- [x] Context server with cryptographic validation (no database on the hot path)
- [x] Configurable session TTL (default 5 min)
- [x] Example agent client in BunJS
- [x] Claude Code integration via `CLAUDE.md`
- [x] Basic README documentation

**Exit criteria:** the full cycle works end-to-end locally with Claude Code.

---

## Phase 1 — Secure foundations (complete)

Goal: make the core production-ready before any external integration.

### Security
- [x] HMAC key rotation without downtime (previous key remains valid during transition window)
- [x] Rate limiting per `session_id` on the context server (default 60 req/min)
- [x] Security headers on all responses (`Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy`, `Referrer-Policy`)
- [x] Structured audit log to stdout in JSON format (events: `page_read`, `token_expired`, `invalid_signature`, `session_revoked`, `rate_limited`, `page_not_found`)
- [x] Timing-attack-safe HMAC comparison (constant-time)
- [x] Path traversal protection on page IDs

### Stability
- [x] Session persistence with SQLite (`bun:sqlite`, WAL mode) to survive restarts
- [x] HMAC keys persisted in SQLite with automatic cleanup
- [x] `GET /session/:id` endpoint to inspect session state
- [x] Semantic error codes with appropriate HTTP status (`token_expired`, `invalid_signature`, `session_revoked`, `page_not_found`, `invalid_request`, `rate_limited`)
- [x] Integration test suite covering all error cases and happy paths (24 tests)
- [x] Automatic cleanup of expired sessions (every 5 min)

### Developer experience
- [x] `context-pages` CLI to create sessions, inspect/revoke them, and generate `CLAUDE.md` from the terminal
- [x] Environment variables documented and validated at startup (fatal exit on invalid config)
- [x] Docker Compose to start the full stack in one command
- [x] Example context pages in three languages (English, Spanish, Chinese Simplified)
- [x] `GET /health` endpoint

**Exit criteria:** an external auditor can review the security model without finding obvious attack vectors.

---

## Phase 2 — Controlled discovery

Goal: allow the orchestrator to discover available pages without exposing them to the agent.

### Internal sitemap
- [ ] Page manifest format (`pages.json`) read by the orchestrator at startup
- [ ] Per-page metadata: `id`, `title`, `description`, `tags`, `requires_permission`
- [ ] `GET /pages` endpoint on the orchestrator (not exposed to agents) — admin-only catalog
- [ ] Simple permission system: users have roles, roles grant access to page tags

### Dynamic pages
- [ ] Support for pages generated at runtime (not just static `.txt` files)
- [ ] `PageProvider` interface anyone can implement: `render(session, page_id) → string`
- [ ] Built-in providers: `FileProvider` (current behavior), `TemplateProvider` (with session variables)
- [ ] External source providers: generate context pages from APIs, PDFs, databases, and other sources

### Assisted discovery
- [ ] Orchestrator suggests relevant pages based on the user's task (simple keyword matching, no AI)
- [ ] Generated `CLAUDE.md` includes a description per page so the agent can decide when to read each one

**Exit criteria:** a new page can be added without touching code — just a file and a `pages.json` entry.

---

## Phase 3 — Integrations

Goal: let other agents and tools use Context Pages with zero friction.

### Claude Code
- [ ] Separate `CLAUDE.session.md` from the project's `CLAUDE.md`
- [ ] `context-pages inject --tool claude-code` command that handles the merge automatically
- [ ] Automatic session renewal before TTL expiration (CLI refreshes the file in the background)

### Cursor / Windsurf
- [ ] Support for `.cursor/context.md` and `.windsurfcontext` as injection targets
- [ ] `context-pages inject --tool cursor`
- [ ] Setup documentation for each IDE

### OpenAI Agents SDK
- [ ] Adapter that exposes context pages as SDK `tools`
- [ ] Agent calls `get_context(page_id)` and the adapter performs the signed fetch internally
- [ ] Full working example with an OpenAI agent

### SDK (optional)
- [ ] `@context-pages/client` — lightweight TypeScript/JS client for any agent
- [ ] Manages sessions, refreshes URLs before expiration, abstracts the fetch
- [ ] Published on npm

**Exit criteria:** each integration has its own working example in the repo with setup instructions under 5 minutes.

---

## Phase 4 — Open source ecosystem

Goal: enable other developers to contribute and extend the system.

### Extensibility
- [ ] Plugin system for `PageProvider` — publishable as independent npm packages
- [ ] Community providers: `GitHubProvider`, `NotionProvider`, `ConfluenceProvider`, `SQLProvider`
- [ ] Curated provider registry

### Observability
- [ ] Per-page and per-session usage metrics (OpenTelemetry)
- [ ] Simple dashboard for active sessions, most-read pages, and errors
- [ ] Configurable alerts: unusual session activity, high error rate on a page

### Governance
- [ ] `CONTRIBUTING.md` with PR process and acceptance criteria
- [ ] Security policy (`SECURITY.md`) with responsible disclosure process
- [ ] Strict semantic versioning — public API does not break in minor versions
- [ ] Changelog maintained with every release

**Exit criteria:** an external contributor can add a new `PageProvider` without help from the maintainer.

---

## Ideas for later (no phase assigned)

Interesting but require more project maturity before committing:

- **Per-page TTL** distinct from session TTL (some pages are more sensitive than others)
- **Context streaming** — serve very long pages in chunks via SSE instead of a single GET
- **Per-page signing keys** — full isolation between pages from different domains
- **Context Pages as an open standard** — published spec so others can build compatible servers, similar to how OpenAPI is a standard independent of its implementations

---

## Out of scope

To maintain focus:

- **Web admin interface** — the CLI is sufficient for an open source project
- **Multi-tenancy** — outside initial scope; each instance serves one organization
- **Binary content support** (images, PDFs as responses) — the model is plain text; that constraint keeps it simple
