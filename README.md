# Context Pages

[English](./README.md) | [中文](./README.zh-CN.md) | [Español](./README.es.md)

Context Pages is a minimalist alternative to the Model Context Protocol (MCP) for providing context to AI agents via standard HTTP. Instead of requiring custom protocols or SDKs, it serves plain-text context pages through signed URLs with HMAC authentication, automatic key rotation, per-session rate limiting, and structured audit logging. Built with Bun and SQLite for minimal footprint and zero external dependencies. 

## Architecture

```
Server (:3000)
  POST /session          — creates session and generates signed URLs
  GET  /context/:page    — validates HMAC and serves plain text
  GET  /session/:id      — inspects session state
  DELETE /session/:id    — revokes session

        | Signed URLs
        v
    Agent / CLI
    (consumes context pages via HTTP GET)
```

## Requirements

- [Bun](https://bun.sh) v1.0+

## Getting Started

### With Docker Compose (recommended)

```bash
docker compose up
```

This starts the server at `http://localhost:3000`. Context pages are read from `server/pages/` and the database is persisted in a Docker volume.

### Without Docker

```bash
cd server && bun run start
```

### Quick demo with expiration

```bash
SESSION_TTL=10 docker compose up
# or without Docker:
cd orchestrator && SESSION_TTL=10 bun run start
```

## Environment Variables

All numeric variables are validated at startup — if the value is not a positive integer, the server will not start and will display an error.

| Variable | Default | Description |
|---|---|---|
| `SESSION_TTL` | `300` | Session time-to-live in seconds |
| `HMAC_TTL` | `3600` | Automatic HMAC key rotation interval in seconds |
| `RATE_LIMIT_RPM` | `60` | Maximum requests per session_id per minute |
| `PORT` | `3000` | Server port |
| `PAGES_DIR` | `./pages` | Directory where context pages (`.txt`) are read from |
| `DB_PATH` | `./data/context-pages.db` | SQLite database file path |

## Security

### HMAC Key Rotation

HMAC keys are automatically generated and rotated every `HMAC_TTL` seconds (default: 1 hour). Keys are persisted in SQLite, so they survive restarts. During rotation, the previous key remains valid for verifying URLs signed before the change.

### Rate Limiting

The context server limits requests per `session_id` to `RATE_LIMIT_RPM` per minute (default: 60). If exceeded, it responds with `429 Too Many Requests` and a `Retry-After` header.

### Audit Log

Every request to the context server is logged to stdout in JSON format:

```json
{"ts":"2026-03-14T12:00:00.000Z","event":"page_read","session_id":"uuid","page_id":"ventas","ip":"127.0.0.1","result":"ok","sig_prefix":"a4d94dfb"}
```

Events: `page_read`, `token_expired`, `invalid_signature`, `session_revoked`, `rate_limited`, `page_not_found`.

### Security Headers

All context server responses include:
- `Cache-Control: no-store, no-cache, must-revalidate`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy: default-src 'none'`
- `Referrer-Policy: no-referrer`

### Security Tests

```bash
cd server && bun test src/tests/
```
