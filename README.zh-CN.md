# Context Pages

[English](./README.md) | [中文](./README.zh-CN.md) | [Español](./README.es.md)

通过标准 HTTP 为 AI 代理提供上下文的极简 MCP 替代方案。

## 架构

```
Server (:3000)
  POST /session          — 创建会话并生成签名 URL
  GET  /context/:page    — 验证 HMAC 并提供纯文本
  GET  /session/:id      — 查看会话状态
  DELETE /session/:id    — 撤销会话

        | 签名 URL
        v
    Agent / CLI
    (通过 HTTP GET 获取上下文页面)
```

## 环境要求

- [Bun](https://bun.sh) v1.0+

## 快速开始

### 使用 Docker Compose（推荐）

```bash
docker compose up
```

服务器将在 `http://localhost:3000` 启动。上下文页面从 `server/pages/` 读取，数据库持久化在 Docker 卷中。

### 不使用 Docker

```bash
cd server && bun run start
```

### 带过期时间的快速演示

```bash
SESSION_TTL=10 docker compose up
# 或不使用 Docker：
cd orchestrator && SESSION_TTL=10 bun run start
```

## 环境变量

所有数值变量在启动时进行验证——如果值不是正整数，服务器将不会启动并显示错误信息。

| 变量 | 默认值 | 描述 |
|---|---|---|
| `SESSION_TTL` | `300` | 会话生存时间（秒） |
| `HMAC_TTL` | `3600` | HMAC 密钥自动轮换间隔（秒） |
| `RATE_LIMIT_RPM` | `60` | 每个 session_id 每分钟最大请求数 |
| `PORT` | `3000` | 服务器端口 |
| `PAGES_DIR` | `./pages` | 上下文页面（`.txt`）读取目录 |
| `DB_PATH` | `./data/context-pages.db` | SQLite 数据库文件路径 |

## 安全性

### HMAC 密钥轮换

HMAC 密钥自动生成，每 `HMAC_TTL` 秒轮换一次（默认：1 小时）。密钥持久化在 SQLite 中，因此可以在重启后保留。轮换期间，旧密钥仍然有效，用于验证轮换前签名的 URL。

### 速率限制

上下文服务器将每个 `session_id` 的请求限制为每分钟 `RATE_LIMIT_RPM` 次（默认：60）。超出限制时，返回 `429 Too Many Requests` 响应，并附带 `Retry-After` 头。

### 审计日志

上下文服务器的每个请求都以 JSON 格式记录到标准输出：

```json
{"ts":"2026-03-14T12:00:00.000Z","event":"page_read","session_id":"uuid","page_id":"ventas","ip":"127.0.0.1","result":"ok","sig_prefix":"a4d94dfb"}
```

事件类型：`page_read`、`token_expired`、`invalid_signature`、`session_revoked`、`rate_limited`、`page_not_found`。

### 安全头

所有上下文服务器响应包含：
- `Cache-Control: no-store, no-cache, must-revalidate`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy: default-src 'none'`
- `Referrer-Policy: no-referrer`

### 安全测试

```bash
cd server && bun test src/tests/
```
