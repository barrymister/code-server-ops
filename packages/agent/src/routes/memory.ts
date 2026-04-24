import type { FastifyInstance } from "fastify";
import { listAllProcs, readProc } from "../collectors/proc.js";
import { consumePreview, issuePreview } from "../preview-tokens.js";
import { findExtensionHost } from "./ai-processes.js";
import type { MemorySample, MemorySnapshot } from "../types.js";

const SAMPLE_INTERVAL_MS = 15_000;
const MAX_SAMPLES = 240; // 1 hour @ 15s

const ringBuffer: MemorySample[] = [];
let sampleTimer: NodeJS.Timeout | null = null;

interface RestartPlan {
  extHostPid: number;
  rssKb: number;
}

interface RestartCommitBody {
  token?: unknown;
}

async function takeSample(): Promise<MemorySample> {
  const procs = await listAllProcs();
  const extHostPid = findExtensionHost(procs);
  const entry = extHostPid !== null ? await readProc(extHostPid) : null;
  return {
    timestamp: new Date().toISOString(),
    extHostPid,
    rssKb: entry?.rssKb ?? 0,
    heapUsedKb: null,
  };
}

export function startMemorySampler(): void {
  if (sampleTimer) return;
  void takeSample().then((s) => {
    ringBuffer.push(s);
  });
  sampleTimer = setInterval(() => {
    takeSample()
      .then((sample) => {
        ringBuffer.push(sample);
        while (ringBuffer.length > MAX_SAMPLES) ringBuffer.shift();
      })
      .catch(() => {
        // Sampler errors must never crash the agent — skip this tick.
      });
  }, SAMPLE_INTERVAL_MS);
  if (typeof sampleTimer.unref === "function") sampleTimer.unref();
}

export function stopMemorySampler(): void {
  if (sampleTimer) {
    clearInterval(sampleTimer);
    sampleTimer = null;
  }
}

export async function memoryRoute(app: FastifyInstance): Promise<void> {
  startMemorySampler();

  app.get("/memory", async (): Promise<MemorySnapshot> => {
    const current = await takeSample();
    return {
      current,
      series: [...ringBuffer],
    };
  });

  app.post("/memory/preview-restart-ext-host", async (_req, reply) => {
    const sample = await takeSample();
    if (sample.extHostPid === null) {
      reply.code(404);
      return { error: "no extension host process found" };
    }
    const plan: RestartPlan = {
      extHostPid: sample.extHostPid,
      rssKb: sample.rssKb,
    };
    const token = issuePreview("memory.restart-ext-host", plan);
    return { token, plan, ttlSeconds: 60 };
  });

  app.post("/memory/restart-ext-host", async (req, reply) => {
    const body = (req.body ?? {}) as RestartCommitBody;
    if (typeof body.token !== "string" || body.token.length === 0) {
      reply.code(400);
      return { error: "token required" };
    }

    const plan = consumePreview<RestartPlan>(
      body.token,
      "memory.restart-ext-host",
    );
    if (!plan) {
      reply.code(410);
      return { error: "preview expired or unknown token — re-run preview" };
    }

    // Revalidate — the ext host PID must still be the current ext host.
    const procs = await listAllProcs();
    const currentExtHost = findExtensionHost(procs);
    if (currentExtHost === null || currentExtHost !== plan.extHostPid) {
      reply.code(409);
      return {
        error: "extension host PID has changed since preview — re-run preview",
        previewPid: plan.extHostPid,
        currentPid: currentExtHost,
      };
    }

    try {
      // SIGTERM — code-server respawns the extension host automatically.
      // This is surgical: code-server itself keeps running.
      process.kill(plan.extHostPid, "SIGTERM");
      return { ok: true, killedPid: plan.extHostPid };
    } catch (err) {
      reply.code(500);
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
}

export function __getRingBufferForTests(): MemorySample[] {
  return ringBuffer;
}
