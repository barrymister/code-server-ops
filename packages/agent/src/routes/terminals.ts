import type { FastifyInstance } from "fastify";
import {
  ageSeconds,
  listAllProcs,
  readBtime,
  startTimeToIso,
  type ProcEntry,
} from "../collectors/proc.js";
import type { TerminalInfo } from "../types.js";

const BASH_MARKERS = [
  "shellIntegration-bash",
  "shellIntegration.bash",
  "shell-integration-bash",
];

export async function terminalsRoute(app: FastifyInstance): Promise<void> {
  app.get("/terminals", async () => {
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
  });
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
