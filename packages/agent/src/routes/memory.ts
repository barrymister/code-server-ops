import type { FastifyInstance } from "fastify";
import { listAllProcs, readProc } from "../collectors/proc.js";
import { findExtensionHost } from "./ai-processes.js";
import type { MemorySample, MemorySnapshot } from "../types.js";

const SAMPLE_INTERVAL_MS = 15_000;
const MAX_SAMPLES = 240; // 1 hour @ 15s

const ringBuffer: MemorySample[] = [];
let sampleTimer: NodeJS.Timeout | null = null;

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
}

export function __getRingBufferForTests(): MemorySample[] {
  return ringBuffer;
}
