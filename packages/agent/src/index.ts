// code-server-ops agent
//
// Read-only Fastify service. Fills the "won't fix" gap upstream left:
//   coder/code-server#6291, #7228     — orphan terminals, "use tmux/screen"
//   microsoft/vscode#213844, #78107   — extension folder orphans
//   microsoft/vscode#294050, #309016  — extension host V8 heap OOM
//
// Endpoints: /terminals /extensions /ai-processes /memory /oom-events /metrics /health

import Fastify from "fastify";
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

  return app;
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
