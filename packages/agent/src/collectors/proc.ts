import { readFile, readdir, readlink } from "node:fs/promises";
import path from "node:path";
import pidusage from "pidusage";

const PROC = process.env.CSOPS_PROC_DIR ?? "/proc";

export interface ProcEntry {
  pid: number;
  cmdline: string[];
  comm: string;
  ppid: number;
  startTimeTicks: number;
  rssKb: number;
  cwd: string | null;
}

export async function listPids(): Promise<number[]> {
  try {
    const entries = await readdir(PROC);
    return entries
      .filter((e) => /^\d+$/.test(e))
      .map((e) => Number.parseInt(e, 10));
  } catch {
    // /proc unreadable (wrong OS, no mount, permission) — degrade to empty set
    return [];
  }
}

export async function readProc(pid: number): Promise<ProcEntry | null> {
  try {
    const [cmdlineRaw, statRaw, statusRaw] = await Promise.all([
      readFile(path.join(PROC, String(pid), "cmdline"), "utf8"),
      readFile(path.join(PROC, String(pid), "stat"), "utf8"),
      readFile(path.join(PROC, String(pid), "status"), "utf8"),
    ]);

    const cmdline = cmdlineRaw.split("\0").filter((s) => s.length > 0);

    const rparenIdx = statRaw.lastIndexOf(")");
    const head = statRaw.slice(0, rparenIdx);
    const tail = statRaw.slice(rparenIdx + 1).trim().split(/\s+/);
    const commMatch = head.match(/^\d+\s+\((.+)$/);
    const comm = commMatch?.[1] ?? "";

    const ppid = Number.parseInt(tail[1] ?? "0", 10);
    const startTimeTicks = Number.parseInt(tail[19] ?? "0", 10);

    const rssMatch = statusRaw.match(/^VmRSS:\s+(\d+)\s+kB/m);
    const rssKb = rssMatch ? Number.parseInt(rssMatch[1] ?? "0", 10) : 0;

    let cwd: string | null = null;
    try {
      cwd = await readlink(path.join(PROC, String(pid), "cwd"));
    } catch {
      cwd = null;
    }

    return { pid, cmdline, comm, ppid, startTimeTicks, rssKb, cwd };
  } catch {
    return null;
  }
}

export async function listAllProcs(): Promise<ProcEntry[]> {
  const pids = await listPids();
  const entries = await Promise.all(pids.map(readProc));
  return entries.filter((e): e is ProcEntry => e !== null);
}

export async function rssOf(pid: number): Promise<number> {
  try {
    const stat = await pidusage(pid);
    return Math.round(stat.memory / 1024);
  } catch {
    return 0;
  }
}

export function btimeSeconds(): number {
  // /proc/stat line "btime <unix-seconds>" is the authoritative host boot time.
  // We read it lazily so tests can override PROC.
  return Date.now() / 1000;
}

export async function readBtime(): Promise<number> {
  try {
    const stat = await readFile(path.join(PROC, "stat"), "utf8");
    const m = stat.match(/^btime\s+(\d+)/m);
    if (m?.[1]) return Number.parseInt(m[1], 10);
  } catch {
    // fall through
  }
  return Math.floor(Date.now() / 1000);
}

const CLOCK_TICKS_PER_SECOND = 100;

export function startTimeToIso(btime: number, startTimeTicks: number): string {
  const unix = btime + startTimeTicks / CLOCK_TICKS_PER_SECOND;
  return new Date(unix * 1000).toISOString();
}

export function ageSeconds(btime: number, startTimeTicks: number): number {
  const unix = btime + startTimeTicks / CLOCK_TICKS_PER_SECOND;
  return Math.max(0, Math.floor(Date.now() / 1000 - unix));
}
