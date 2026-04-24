import type { FastifyInstance } from "fastify";
import {
  ageSeconds,
  listAllProcs,
  readBtime,
  startTimeToIso,
  type ProcEntry,
} from "../collectors/proc.js";
import { consumePreview, issuePreview } from "../preview-tokens.js";
import type { TerminalInfo } from "../types.js";

const BASH_MARKERS = [
  "shellIntegration-bash",
  "shellIntegration.bash",
  "shell-integration-bash",
];

interface KillPreviewBody {
  pids?: unknown;
  orphanOnly?: unknown;
  olderThanSeconds?: unknown;
}

interface KillCommitBody {
  token?: unknown;
}

interface KillPlanEntry {
  pid: number;
  lstart: string;
  ageSeconds: number;
  rssKb: number;
  attached: boolean;
  cwd: string | null;
}

interface KillResult {
  pid: number;
  ok: boolean;
  error?: string;
}

export async function terminalsRoute(app: FastifyInstance): Promise<void> {
  app.get("/terminals", async () => readTerminals());

  app.post("/terminals/preview-kill", async (req, reply) => {
    const body = (req.body ?? {}) as KillPreviewBody;
    const allowedPids = parsePidArray(body.pids);
    const orphanOnly = body.orphanOnly === true;
    const olderThanSeconds =
      typeof body.olderThanSeconds === "number" && Number.isFinite(body.olderThanSeconds)
        ? Math.max(0, Math.floor(body.olderThanSeconds))
        : 0;

    const terminals = await readTerminals();
    const candidates = terminals.filter((t) => {
      if (orphanOnly && t.attached) return false;
      if (olderThanSeconds > 0 && t.ageSeconds < olderThanSeconds) return false;
      if (allowedPids && !allowedPids.includes(t.pid)) return false;
      return true;
    });

    const plan: KillPlanEntry[] = candidates.map((t) => ({
      pid: t.pid,
      lstart: t.lstart,
      ageSeconds: t.ageSeconds,
      rssKb: t.rssKb,
      attached: t.attached,
      cwd: t.cwd,
    }));

    if (plan.length === 0) {
      reply.code(400);
      return { error: "no terminals match the requested plan" };
    }

    const token = issuePreview("terminals.kill", plan);
    return { token, plan, ttlSeconds: 60 };
  });

  app.post("/terminals/kill", async (req, reply) => {
    const body = (req.body ?? {}) as KillCommitBody;
    if (typeof body.token !== "string" || body.token.length === 0) {
      reply.code(400);
      return { error: "token required" };
    }

    const plan = consumePreview<KillPlanEntry[]>(body.token, "terminals.kill");
    if (!plan) {
      reply.code(410);
      return { error: "preview expired or unknown token — re-run preview" };
    }

    // Revalidate — refuse to kill any PID that is no longer a shell-integration bash.
    const stillBash = new Set(
      (await readTerminals()).map((t) => t.pid),
    );

    const results: KillResult[] = [];
    for (const entry of plan) {
      if (!stillBash.has(entry.pid)) {
        results.push({
          pid: entry.pid,
          ok: false,
          error: "no longer a shell-integration bash — aborted",
        });
        continue;
      }
      try {
        process.kill(entry.pid, "SIGKILL");
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

async function readTerminals(): Promise<TerminalInfo[]> {
  const [procs, btime] = await Promise.all([listAllProcs(), readBtime()]);
  const ptyHostPid = findPtyHost(procs);
  const bashes = procs.filter(isShellIntegrationBash);

  return bashes.map<TerminalInfo>((p) => ({
    pid: p.pid,
    lstart: startTimeToIso(btime, p.startTimeTicks),
    ageSeconds: ageSeconds(btime, p.startTimeTicks),
    rssKb: p.rssKb,
    ptyHostPid,
    attached: ptyHostPid !== null && p.ppid === ptyHostPid,
    cwd: p.cwd,
  }));
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

export function isShellIntegrationBash(proc: ProcEntry): boolean {
  const joined = proc.cmdline.join(" ");
  return BASH_MARKERS.some((m) => joined.includes(m));
}

export function findPtyHost(procs: ProcEntry[]): number | null {
  for (const p of procs) {
    if (
      p.cmdline.some((arg) => arg.includes("ptyHostMain")) ||
      p.comm === "ptyHost" ||
      p.cmdline.some((arg) => arg.includes("--type=ptyHost"))
    ) {
      return p.pid;
    }
  }
  return null;
}
