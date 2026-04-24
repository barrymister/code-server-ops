import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import type { OomEvent } from "../types.js";

const OOM_KILL_REGEX =
  /Out of memory: Killed process (\d+) \(([^)]+)\)|invoked oom-killer.*?\skill process (\d+) \(([^)]+)\)/i;

export async function collectOomEvents(
  windowSecs = 7 * 24 * 3600,
): Promise<OomEvent[]> {
  const journal = await tryJournalctl(windowSecs);
  if (journal !== null) return parseJournalctlLines(journal);

  const kern = await tryKernLog();
  if (kern !== null) return parseKernLogLines(kern, windowSecs);

  return [];
}

async function tryJournalctl(windowSecs: number): Promise<string | null> {
  return await new Promise((resolve) => {
    const child = spawn(
      "journalctl",
      [
        "-k",
        "--no-pager",
        "--since",
        `${windowSecs} seconds ago`,
        "--output=short-iso",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", () => resolve(null));
    child.on("close", (code) => {
      if (code === 0) resolve(out);
      else if (err.includes("No journal files")) resolve(null);
      else resolve(out.length > 0 ? out : null);
    });
  });
}

async function tryKernLog(): Promise<string | null> {
  try {
    return await readFile("/var/log/kern.log", "utf8");
  } catch {
    return null;
  }
}

export function parseJournalctlLines(raw: string): OomEvent[] {
  const events: OomEvent[] = [];
  for (const line of raw.split("\n")) {
    const m = line.match(OOM_KILL_REGEX);
    if (!m) continue;
    const pidStr = m[1] ?? m[3];
    const comm = m[2] ?? m[4];
    if (!pidStr || !comm) continue;
    const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:+-]+)/);
    const timestamp = tsMatch?.[1] ?? new Date().toISOString();
    events.push({
      timestamp,
      pid: Number.parseInt(pidStr, 10),
      comm,
      containerHint: null,
    });
  }
  return events;
}

function parseKernLogLines(raw: string, windowSecs: number): OomEvent[] {
  const events: OomEvent[] = [];
  const cutoff = Date.now() - windowSecs * 1000;
  for (const line of raw.split("\n")) {
    const m = line.match(OOM_KILL_REGEX);
    if (!m) continue;
    const pidStr = m[1] ?? m[3];
    const comm = m[2] ?? m[4];
    if (!pidStr || !comm) continue;
    // kern.log uses syslog timestamps like "Apr 24 14:32:10". We don't attempt to
    // reconstruct the year here; emit now() and rely on the journalctl path for accurate times.
    const ts = Date.now();
    if (ts < cutoff) continue;
    events.push({
      timestamp: new Date(ts).toISOString(),
      pid: Number.parseInt(pidStr, 10),
      comm,
      containerHint: null,
    });
  }
  return events;
}
