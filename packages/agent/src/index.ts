// code-server-ops agent
//
// Fastify service serving a read + mutation REST API and (optionally) the
// bundled UI static assets. Fills the "won't fix" gap upstream left:
//   coder/code-server#6291, #7228     — orphan terminals, "use tmux/screen"
//   microsoft/vscode#213844, #78107   — extension folder orphans
//   microsoft/vscode#294050, #309016  — extension host V8 heap OOM
//
// API: /terminals /extensions /ai-processes /memory /oom-events /metrics /health
// Mutations use a Preview→Confirm token pattern (see src/preview-tokens.ts).

import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { registerAuth } from "./auth.js";
import { terminalsRoute } from "./routes/terminals.js";
import { extensionsRoute } from "./routes/extensions.js";
import { aiProcessesRoute } from "./routes/ai-processes.js";
import { memoryRoute } from "./routes/memory.js";
import { oomEventsRoute } from "./routes/oom-events.js";
import { metricsRoute } from "./routes/metrics.js";

export async function buildApp(): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify({
    logger: {
      level: process.env.CSOPS_LOG_LEVEL ?? "info",
    },
  });

  await registerAuth(app);

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(terminalsRoute);
  await app.register(extensionsRoute);
  await app.register(aiProcessesRoute);
  await app.register(memoryRoute);
  await app.register(oomEventsRoute);
  await app.register(metricsRoute);

  await registerUiStatic(app);

  return app;
}

async function registerUiStatic(app: FastifyInstance): Promise<void> {
  const uiRoot = await resolveUiRoot();
  if (!uiRoot) {
    app.log.info("UI static assets not found — serving API only");
    return;
  }
  app.log.info({ uiRoot }, "serving UI static assets");
  await app.register(fastifyStatic, {
    root: uiRoot,
    prefix: "/",
  });
  // SPA fallback — let /anything that 404s fall through to index.html
  app.setNotFoundHandler((req, reply) => {
    if (req.method !== "GET") {
      reply.code(404).send({ error: "not found" });
      return;
    }
    reply.sendFile("index.html", uiRoot);
  });
}

async function resolveUiRoot(): Promise<string | null> {
  // Allow override for local dev.
  const override = process.env.CSOPS_UI_ROOT;
  if (override) {
    return (await pathExists(override)) ? override : null;
  }

  // Default: ./ui next to the agent's entry (bundled-image layout).
  const here = path.dirname(fileURLToPath(import.meta.url));
  const bundled = path.resolve(here, "..", "ui");
  if (await pathExists(path.join(bundled, "index.html"))) return bundled;

  const sibling = path.resolve(here, "ui");
  if (await pathExists(path.join(sibling, "index.html"))) return sibling;

  return null;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const port = Number.parseInt(process.env.CSOPS_PORT ?? "4242", 10);
  const host = process.env.CSOPS_HOST ?? "0.0.0.0";

  const app = await buildApp();
  try {
    await app.listen({ port, host });
    app.log.info(`code-server-ops agent listening on ${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const entryArg = (process.argv[1] ?? "").replace(/\\/g, "/");
const isEntry =
  entryArg.endsWith("dist/index.js") ||
  entryArg.endsWith("dist/index.mjs") ||
  entryArg.endsWith("code-server-ops-agent");

if (isEntry) {
  void main();
}
