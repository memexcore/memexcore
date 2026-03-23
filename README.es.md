# Context Pages

[English](./README.md) | [中文](./README.zh-CN.md) | [Español](./README.es.md)

Alternativa minimalista a MCP para proveer contexto a agentes de IA vía HTTP estándar.

## Arquitectura

```
Server (:3000)
  POST /session          — crea sesión y genera URLs firmadas
  GET  /context/:page    — valida HMAC y sirve texto plano
  GET  /session/:id      — inspecciona estado de sesión
  DELETE /session/:id    — revoca sesión

        | URLs firmadas
        v
    Agent / CLI
    (consume context pages via HTTP GET)
```

## Requisitos

- [Bun](https://bun.sh) v1.0+

## Cómo correr

### Con Docker Compose (recomendado)

```bash
docker compose up
```

Esto levanta el servidor en `http://localhost:3000`. Las context pages se leen de `server/pages/` y la base de datos se persiste en un volumen Docker.

### Sin Docker

```bash
cd server && bun run start
```

### Demo rápida con expiración

```bash
SESSION_TTL=10 docker compose up
# o sin Docker:
cd orchestrator && SESSION_TTL=10 bun run start
```

## Variables de entorno

Todas las variables numéricas se validan al arranque — si el valor no es un entero positivo, el servidor no arranca y muestra el error.

| Variable | Default | Descripción |
|---|---|---|
| `SESSION_TTL` | `300` | Tiempo de vida de sesión en segundos |
| `HMAC_TTL` | `3600` | Intervalo de rotación automática de claves HMAC en segundos |
| `RATE_LIMIT_RPM` | `60` | Requests máximos por session_id por minuto |
| `PORT` | `3000` | Puerto del servidor |
| `PAGES_DIR` | `./pages` | Directorio donde se leen las context pages (`.txt`) |
| `DB_PATH` | `./data/context-pages.db` | Ruta del archivo SQLite |

## Seguridad

### Rotación de claves HMAC

Las claves HMAC se generan automáticamente y se rotan cada `HMAC_TTL` segundos (default: 1 hora). Las claves se persisten en SQLite, por lo que sobreviven reinicios. Durante la rotación, la clave anterior se mantiene válida para verificar URLs firmadas antes del cambio.

### Rate limiting

El context server limita requests por `session_id` a `RATE_LIMIT_RPM` por minuto (default: 60). Si se excede, responde `429 Too Many Requests` con header `Retry-After`.

### Audit log

Cada request al context server se loguea a stdout en formato JSON:

```json
{"ts":"2026-03-14T12:00:00.000Z","event":"page_read","session_id":"uuid","page_id":"ventas","ip":"127.0.0.1","result":"ok","sig_prefix":"a4d94dfb"}
```

Eventos: `page_read`, `token_expired`, `invalid_signature`, `session_revoked`, `rate_limited`, `page_not_found`.

### Headers de seguridad

Todas las respuestas del context server incluyen:
- `Cache-Control: no-store, no-cache, must-revalidate`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy: default-src 'none'`
- `Referrer-Policy: no-referrer`

### Tests de seguridad

```bash
cd server && bun test src/tests/
```
