import type { FastifyInstance } from "fastify";
import { Counter, Gauge, Registry, collectDefaultMetrics } from "prom-client";
import { listAllProcs, readBtime, ageSeconds } from "../collectors/proc.js";
import { collectExtensions } from "../collectors/extensions.js";
import { collectOomEvents } from "../collectors/journalctl.js";
import { findPtyHost, isShellIntegrationBash } from "./terminals.js";

export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry });

const terminalsOrphan = new Gauge({
  name: "csops_terminals_orphan_total",
  help: "Number of shell-integration bash processes whose parent is not ptyHost.",
  registers: [metricsRegistry],
});

const extensionsOrphanBytes = new Gauge({
  name: "csops_extensions_orphan_bytes",
  help: "Disk bytes consumed by extension folders not registered in extensions.json.",
  registers: [metricsRegistry],
});

const aiProcessesTotal = new Gauge({
  name: "csops_ai_processes_total",
  help: "AI assistant processes detected by extension family.",
  labelNames: ["extension"] as const,
  registers: [metricsRegistry],
});

const oomEventsTotal = new Counter({
  name: "csops_oom_events_total",
  help: "Cumulative OOM kill events observed by the agent since process start.",
  registers: [metricsRegistry],
});

const extHostRssBytes = new Gauge({
  name: "csops_ext_host_rss_bytes",
  help: "Extension host process RSS in bytes.",
  registers: [metricsRegistry],
});

let lastOomCount = 0;

async function refresh(): Promise<void> {
  const [procs, btime, exts, ooms] = await Promise.all([
    listAllProcs(),
    readBtime(),
    collectExtensions(),
    collectOomEvents(24 * 3600),
  ]);
  void btime;

  const ptyHost = findPtyHost(procs);
  const bashes = procs.filter(isShellIntegrationBash);
  const orphanBashes = bashes.filter((p) => ptyHost === null || p.ppid !== ptyHost);
  terminalsOrphan.set(orphanBashes.length);

  const orphanBytes = exts
    .filter((e) => e.orphan)
    .reduce((sum, e) => sum + e.sizeKb * 1024, 0);
  extensionsOrphanBytes.set(orphanBytes);

  const aiCounts = new Map<string, number>();
  for (const p of procs) {
    const joined = p.cmdline.join(" ");
    if (joined.includes("claude-code")) bump(aiCounts, "claude-code");
    if (/\bcodex\b/.test(joined)) bump(aiCounts, "codex");
    if (/copilot-language-server|copilot-agent/.test(joined)) bump(aiCounts, "github-copilot");
    if (joined.includes("continue.continue")) bump(aiCounts, "continue");
    if (/\bcline\b|saoudrizwan\.claude-dev/.test(joined)) bump(aiCounts, "cline");
  }
  aiProcessesTotal.reset();
  for (const [ext, n] of aiCounts) aiProcessesTotal.labels(ext).set(n);

  const extHost = procs.find(
    (p) =>
      p.cmdline.some((a) => a.includes("extensionHost")) ||
      p.cmdline.some((a) => a.includes("--type=extensionHost")),
  );
  extHostRssBytes.set(extHost ? extHost.rssKb * 1024 : 0);

  const newOoms = ooms.length - lastOomCount;
  if (newOoms > 0) oomEventsTotal.inc(newOoms);
  lastOomCount = ooms.length;

  // suppress unused warnings for helpers not read back outside
  void ageSeconds;
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export async function metricsRoute(app: FastifyInstance): Promise<void> {
  app.get("/metrics", async (_req, reply) => {
    try {
      await refresh();
    } catch {
      // emit whatever we have — never fail /metrics
    }
    reply.header("content-type", metricsRegistry.contentType);
    return metricsRegistry.metrics();
  });
}
