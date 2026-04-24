import type { FastifyInstance } from "fastify";
import {
  ageSeconds,
  listAllProcs,
  readBtime,
  type ProcEntry,
} from "../collectors/proc.js";
import { consumePreview, issuePreview } from "../preview-tokens.js";
import type { AiProcessInfo } from "../types.js";

interface Matcher {
  extension: string;
  test: (proc: ProcEntry) => boolean;
}

const MATCHERS: Matcher[] = [
  {
    extension: "claude-code",
    test: (p) => p.cmdline.some((a) => a.includes("claude-code")),
  },
  {
    extension: "codex",
    test: (p) =>
      p.cmdline.some((a) => /\bcodex\b|openai-codex/.test(a)),
  },
  {
    extension: "github-copilot",
    test: (p) =>
      p.cmdline.some((a) => /copilot-language-server|copilot-agent/.test(a)),
  },
  {
    extension: "continue",
    test: (p) => p.cmdline.some((a) => a.includes("continue.continue")),
  },
  {
    extension: "cline",
    test: (p) => p.cmdline.some((a) => /\bcline\b|saoudrizwan\.claude-dev/.test(a)),
  },
];

const CONVERSATION_ID_REGEX = /--conversation[-_]id[= ]([0-9a-f-]{8,})/i;

interface AiKillPreviewBody {
  pids?: unknown;
  extension?: unknown;
  duplicatesOnly?: unknown;
}

interface AiKillCommitBody {
  token?: unknown;
}

interface AiKillPlanEntry {
  pid: number;
  extension: string;
  uptimeSeconds: number;
  rssKb: number;
}

interface AiKillResult {
  pid: number;
  ok: boolean;
  error?: string;
}

export async function aiProcessesRoute(app: FastifyInstance): Promise<void> {
  app.get("/ai-processes", async () => readAiProcesses());

  app.post("/ai-processes/preview-kill", async (req, reply) => {
    const body = (req.body ?? {}) as AiKillPreviewBody;
    const allowedPids = parsePidArray(body.pids);
    const extensionFilter =
      typeof body.extension === "string" && body.extension.length > 0
        ? body.extension
        : null;
    const duplicatesOnly = body.duplicatesOnly === true;

    const procs = await readAiProcesses();
    let candidates = procs;
    if (allowedPids) {
      candidates = candidates.filter((p) => allowedPids.includes(p.pid));
    }
    if (extensionFilter) {
      candidates = candidates.filter((p) => p.extension === extensionFilter);
    }
    if (duplicatesOnly) {
      const counts = new Map<string, number>();
      for (const p of procs) {
        counts.set(p.extension, (counts.get(p.extension) ?? 0) + 1);
      }
      // Keep only processes from extensions with >1 instance; within each, drop
      // the oldest (likely the active panel) and keep the duplicates.
      const byExt = new Map<string, AiProcessInfo[]>();
      for (const p of candidates) {
        if ((counts.get(p.extension) ?? 0) <= 1) continue;
        if (!byExt.has(p.extension)) byExt.set(p.extension, []);
        byExt.get(p.extension)!.push(p);
      }
      candidates = [];
      for (const [, list] of byExt) {
        list.sort((a, b) => b.uptimeSeconds - a.uptimeSeconds);
        // Keep the oldest (list[0]) — kill everything newer.
        candidates.push(...list.slice(1));
      }
    }

    const plan: AiKillPlanEntry[] = candidates.map((p) => ({
      pid: p.pid,
      extension: p.extension,
      uptimeSeconds: p.uptimeSeconds,
      rssKb: p.rssKb,
    }));

    if (plan.length === 0) {
      reply.code(400);
      return { error: "no AI processes match the requested plan" };
    }

    const token = issuePreview("ai-processes.kill", plan);
    return { token, plan, ttlSeconds: 60 };
  });

  app.post("/ai-processes/kill", async (req, reply) => {
    const body = (req.body ?? {}) as AiKillCommitBody;
    if (typeof body.token !== "string" || body.token.length === 0) {
      reply.code(400);
      return { error: "token required" };
    }

    const plan = consumePreview<AiKillPlanEntry[]>(body.token, "ai-processes.kill");
    if (!plan) {
      reply.code(410);
      return { error: "preview expired or unknown token — re-run preview" };
    }

    // Revalidate — only kill PIDs that still match a known AI-process pattern.
    const current = await readAiProcesses();
    const stillAi = new Set(current.map((p) => p.pid));

    const results: AiKillResult[] = [];
    for (const entry of plan) {
      if (!stillAi.has(entry.pid)) {
        results.push({
          pid: entry.pid,
          ok: false,
          error: "no longer an AI process — aborted",
        });
        continue;
      }
      try {
        process.kill(entry.pid, "SIGTERM");
        results.push({ pid: entry.pid, ok: true });
      } catch (err) {
        results.push({
          pid: entry.pid,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { results };
  });
}

async function readAiProcesses(): Promise<AiProcessInfo[]> {
  const [procs, btime] = await Promise.all([listAllProcs(), readBtime()]);
  const extHostPid = findExtensionHost(procs);

  const out: AiProcessInfo[] = [];
  for (const proc of procs) {
    const matcher = MATCHERS.find((m) => m.test(proc));
    if (!matcher) continue;
    const joined = proc.cmdline.join(" ");
    const convMatch = joined.match(CONVERSATION_ID_REGEX);
    out.push({
      pid: proc.pid,
      extension: matcher.extension,
      conversationId: convMatch?.[1] ?? null,
      uptimeSeconds: ageSeconds(btime, proc.startTimeTicks),
      rssKb: proc.rssKb,
      extensionHostPid: extHostPid,
    });
  }
  return out;
}

function parsePidArray(v: unknown): number[] | null {
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v)) return null;
  const out: number[] = [];
  for (const item of v) {
    if (typeof item === "number" && Number.isInteger(item) && item > 0) {
      out.push(item);
    }
  }
  return out;
}

export function findExtensionHost(procs: ProcEntry[]): number | null {
  for (const p of procs) {
    if (
      p.cmdline.some((arg) => arg.includes("extensionHost")) ||
      p.cmdline.some((arg) => arg.includes("--type=extensionHost"))
    ) {
      return p.pid;
    }
  }
  return null;
}
