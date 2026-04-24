import { Command } from "commander";
import kleur from "kleur";
import { get, post } from "../client.js";
import { formatDuration, formatKb, parseDuration } from "../format.js";

interface TerminalInfo {
  pid: number;
  lstart: string;
  ageSeconds: number;
  rssKb: number;
  ptyHostPid: number | null;
  attached: boolean;
  cwd: string | null;
}

interface KillPreview {
  token: string;
  plan: Array<{
    pid: number;
    ageSeconds: number;
    rssKb: number;
    attached: boolean;
    cwd: string | null;
  }>;
  ttlSeconds: number;
}

interface KillResult {
  pid: number;
  ok: boolean;
  error?: string;
}

export function terminalsCommand(): Command {
  const cmd = new Command("terminals").description(
    "Inspect code-server bash shell-integration terminal processes.",
  );

  cmd
    .command("list")
    .description("List terminals")
    .option("--orphan-only", "show only terminals not attached to ptyHost")
    .option(
      "--older-than <duration>",
      "filter to terminals older than this (e.g. 24h, 7d)",
    )
    .option("--json", "emit JSON")
    .action(async (opts: { orphanOnly?: boolean; olderThan?: string; json?: boolean }) => {
      const terminals = await get<TerminalInfo[]>("/terminals");
      const minAge = opts.olderThan ? parseDuration(opts.olderThan) : 0;
      const filtered = terminals.filter((t) => {
        if (opts.orphanOnly && t.attached) return false;
        if (minAge > 0 && t.ageSeconds < minAge) return false;
        return true;
      });

      if (opts.json) {
        process.stdout.write(JSON.stringify(filtered, null, 2) + "\n");
        return;
      }

      if (filtered.length === 0) {
        console.log(kleur.dim("(no matching terminals)"));
        return;
      }

      console.log(
        kleur.bold(["PID", "AGE", "RSS", "ATTACHED", "CWD"].join("\t")),
      );
      for (const t of filtered) {
        const attachedStr = t.attached ? kleur.green("yes") : kleur.red("no");
        console.log(
          [
            t.pid,
            formatDuration(t.ageSeconds),
            formatKb(t.rssKb),
            attachedStr,
            t.cwd ?? "-",
          ].join("\t"),
        );
      }
    });

  cmd
    .command("kill <pid>")
    .description("Kill a single shell-integration bash by PID")
    .option("--yes", "skip the confirmation prompt")
    .option("--json", "emit JSON")
    .action(async (pidArg: string, opts: { yes?: boolean; json?: boolean }) => {
      const pid = Number.parseInt(pidArg, 10);
      if (!Number.isInteger(pid) || pid <= 0) {
        console.error(kleur.red(`invalid pid: ${pidArg}`));
        process.exit(1);
      }
      await runKill({ pids: [pid] }, opts);
    });

  cmd
    .command("kill-orphans")
    .description("Kill all shell-integration bash terminals not attached to ptyHost")
    .option("--older-than <duration>", "only kill those older than this (e.g. 24h)")
    .option("--yes", "skip the confirmation prompt")
    .option("--json", "emit JSON")
    .action(
      async (opts: { olderThan?: string; yes?: boolean; json?: boolean }) => {
        const olderThanSeconds = opts.olderThan ? parseDuration(opts.olderThan) : 0;
        await runKill({ orphanOnly: true, olderThanSeconds }, opts);
      },
    );

  return cmd;
}

async function runKill(
  previewBody: Record<string, unknown>,
  opts: { yes?: boolean; json?: boolean },
): Promise<void> {
  const preview = await post<KillPreview>("/terminals/preview-kill", previewBody);

  if (opts.json && !opts.yes) {
    process.stdout.write(JSON.stringify({ preview }, null, 2) + "\n");
    console.error(kleur.yellow("Re-run with --yes to commit."));
    return;
  }

  if (!opts.json) {
    console.log(
      kleur.yellow(
        `Preview — ${preview.plan.length} terminal(s) will be SIGKILL'd:`,
      ),
    );
    for (const p of preview.plan) {
      console.log(
        `  pid=${p.pid}  age=${formatDuration(p.ageSeconds)}  rss=${formatKb(p.rssKb)}  cwd=${p.cwd ?? "-"}`,
      );
    }
  }

  if (!opts.yes) {
    console.error(kleur.yellow("Re-run with --yes to commit."));
    return;
  }

  const result = await post<{ results: KillResult[] }>("/terminals/kill", {
    token: preview.token,
  });

  if (opts.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return;
  }

  const ok = result.results.filter((r) => r.ok).length;
  const failed = result.results.length - ok;
  console.log(
    failed === 0
      ? kleur.green(`✓ killed ${ok} terminal(s)`)
      : kleur.yellow(`killed ${ok}, failed ${failed}`),
  );
  for (const r of result.results) {
    if (!r.ok) {
      console.log(`  ${kleur.red("✗")} pid=${r.pid}  ${r.error ?? ""}`);
    }
  }
}
