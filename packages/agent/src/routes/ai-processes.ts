import type { FastifyInstance } from "fastify";
import {
  ageSeconds,
  listAllProcs,
  readBtime,
  type ProcEntry,
} from "../collectors/proc.js";
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

export async function aiProcessesRoute(app: FastifyInstance): Promise<void> {
  app.get("/ai-processes", async () => {
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
  });
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
