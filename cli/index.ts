#!/usr/bin/env bun

import path from "node:path";

let SERVER_URL = process.env.SERVER_URL ?? "http://localhost:3000";

// --- Helpers ---

function fatal(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

async function apiRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const url = `${SERVER_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    const code = (data as { error?: { code?: string } }).error?.code ?? res.statusText;
    const msg = (data as { error?: { message?: string } }).error?.message ?? "unknown error";
    fatal(`${code}: ${msg}`);
  }

  return data;
}

function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

function usage(): never {
  console.log(`context-pages — CLI para Context Pages

Uso:
  context-pages session create  --user <id> --pages <p1,p2,...>
  context-pages session get     <session_id>
  context-pages session delete  <session_id>
  context-pages generate        --user <id> --pages <p1,p2,...> [--output <path>]

Opciones globales:
  --server <url>   URL del servidor (default: $SERVER_URL o http://localhost:3000)
  --help                 Muestra esta ayuda

Ejemplos:
  context-pages session create --user agent-001 --pages ventas,producto
  context-pages generate --user agent-001 --pages ventas,producto,clientes
  context-pages generate --user agent-001 --pages ventas --output ./project/CLAUDE.md
  context-pages session get abc-123
  context-pages session delete abc-123`);
  process.exit(0);
}

// --- Arg parsing ---

function parseArgs(args: string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "true";
      }
    } else {
      positional.push(arg);
    }
  }

  return { positional, flags };
}

// --- Commands ---

async function sessionCreate(flags: Record<string, string>): Promise<void> {
  const user = flags.user;
  const pagesRaw = flags.pages;

  if (!user) fatal("se requiere --user <id>");
  if (!pagesRaw) fatal("se requiere --pages <page1,page2,...>");

  const pages = pagesRaw.split(",").map((p) => p.trim()).filter(Boolean);
  if (pages.length === 0) fatal("se requiere al menos una página");

  const data = await apiRequest("POST", "/session", { user_id: user, pages });

  printJson(data);
}

async function sessionGet(sessionId: string): Promise<void> {
  if (!sessionId) fatal("se requiere <session_id>");

  const data = await apiRequest("GET", `/session/${sessionId}`);
  printJson(data);
}

async function sessionDelete(sessionId: string): Promise<void> {
  if (!sessionId) fatal("se requiere <session_id>");

  const data = await apiRequest("DELETE", `/session/${sessionId}`);
  printJson(data);
}

async function generateClaudeMd(flags: Record<string, string>): Promise<void> {
  const user = flags.user;
  const pagesRaw = flags.pages;
  const output = flags.output ?? "./CLAUDE.md";

  if (!user) fatal("se requiere --user <id>");
  if (!pagesRaw) fatal("se requiere --pages <page1,page2,...>");

  const pages = pagesRaw.split(",").map((p) => p.trim()).filter(Boolean);
  if (pages.length === 0) fatal("se requiere al menos una página");

  // Create session via API
  const data = (await apiRequest("POST", "/session", { user_id: user, pages })) as {
    session_id: string;
    expires_at: number;
    context_urls: Record<string, string>;
  };

  // Build CLAUDE.md content
  const urlList = Object.entries(data.context_urls)
    .map(([page, url]) => `- **${page}**: \`${url}\``)
    .join("\n");

  const content = `# Context Pages — Sesión activa

## Instrucciones

Tenés acceso a páginas de contexto via HTTP. Cuando necesites información
sobre alguno de los temas disponibles, haz curl method GET a la URL correspondiente.
Las URLs expiran a las ${new Date(data.expires_at * 1000).toISOString()}.

## Cómo usar las URLs

Usá la herramienta CURL para hacer GET a las URLs.
El contenido es texto plano — leelo y usalo como contexto para tu tarea.

Si recibís un error, el campo \`error.code\` indica el motivo:
- \`token_expired\` (401): la sesión expiró — pedile al usuario que genere una nueva
- \`session_revoked\` (403): la sesión fue revocada
- \`invalid_signature\` (401): la firma no es válida
- \`page_not_found\` (404): la página no existe

## URLs disponibles

${urlList}

## Session ID

\`${data.session_id}\`

---
*Generado automáticamente por Context Pages CLI. No editar manualmente.*
`;

  const resolvedPath = path.resolve(output);
  await Bun.write(resolvedPath, content);

  console.log(`session:   ${data.session_id}`);
  console.log(`expires:   ${new Date(data.expires_at * 1000).toISOString()}`);
  console.log(`pages:     ${pages.join(", ")}`);
  console.log(`written:   ${resolvedPath}`);
}

// --- Main ---

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.length === 0 || rawArgs.includes("--help")) {
    usage();
  }

  const { positional, flags } = parseArgs(rawArgs);

  if (flags.server) {
    SERVER_URL = flags.server;
  }

  const command = positional[0];
  const subcommand = positional[1];

  if (command === "session") {
    if (subcommand === "create") {
      await sessionCreate(flags);
    } else if (subcommand === "get") {
      await sessionGet(positional[2]);
    } else if (subcommand === "delete") {
      await sessionDelete(positional[2]);
    } else {
      fatal(`subcomando desconocido: session ${subcommand ?? ""}\nUsá --help para ver los comandos disponibles.`);
    }
  } else if (command === "generate") {
    await generateClaudeMd(flags);
  } else {
    fatal(`comando desconocido: ${command}\nUsá --help para ver los comandos disponibles.`);
  }
}

main().catch((err) => {
  const msg = err?.message ?? String(err);
  if (msg.includes("Unable to connect") || msg.includes("ECONNREFUSED") || msg.includes("fetch")) {
    fatal(`no se pudo conectar al servidor en ${SERVER_URL}. ¿Está corriendo?`);
  }
  fatal(msg);
});
