import { Command } from "commander";
import kleur from "kleur";
import { get } from "../client.js";
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
    .description("Preview only in v0.0.1-alpha.1 — prints the kill command for you to run.")
    .action((pid: string) => {
      console.log(
        kleur.yellow(
          "Preview mode — mutation endpoints land in v0.1.0. Run this on the host:",
        ),
      );
      console.log(`  sudo kill -9 ${pid}`);
    });

  return cmd;
}
