import { Command } from "commander";
import kleur from "kleur";
import { get, post } from "../client.js";
import { formatKb } from "../format.js";

interface ExtensionInfo {
  name: string;
  version: string;
  sizeKb: number;
  registered: boolean;
  orphan: boolean;
  multiVersionPeers: string[];
}

interface GcPreview {
  token: string;
  plan: Array<{
    folderName: string;
    name: string;
    version: string;
    sizeKb: number;
  }>;
  reclaimableKb: number;
  ttlSeconds: number;
}

interface GcResult {
  folderName: string;
  ok: boolean;
  reclaimedKb: number;
  error?: string;
}

export function extensionsCommand(): Command {
  const cmd = new Command("extensions").description(
    "Inspect on-disk code-server extension folders vs extensions.json registry.",
  );

  cmd
    .command("list")
    .description("List installed extension folders")
    .option("--orphan-only", "show only folders not in extensions.json")
    .option("--json", "emit JSON")
    .action(async (opts: { orphanOnly?: boolean; json?: boolean }) => {
      const exts = await get<ExtensionInfo[]>("/extensions");
      const filtered = opts.orphanOnly ? exts.filter((e) => e.orphan) : exts;

      if (opts.json) {
        process.stdout.write(JSON.stringify(filtered, null, 2) + "\n");
        return;
      }

      if (filtered.length === 0) {
        console.log(kleur.dim("(no matching extensions)"));
        return;
      }

      console.log(
        kleur.bold(
          ["NAME", "VERSION", "SIZE", "REGISTERED", "PEERS"].join("\t"),
        ),
      );
      for (const e of filtered) {
        const reg = e.registered ? kleur.green("yes") : kleur.red("no");
        console.log(
          [
            e.name,
            e.version,
            formatKb(e.sizeKb),
            reg,
            e.multiVersionPeers.length ? String(e.multiVersionPeers.length) : "-",
          ].join("\t"),
        );
      }
    });

  cmd
    .command("gc")
    .description("Garbage-collect orphan extension folders (Preview → confirm)")
    .option("--yes", "skip the confirmation prompt and delete now")
    .option("--json", "emit JSON")
    .action(async (opts: { yes?: boolean; json?: boolean }) => {
      const preview = await post<GcPreview>("/extensions/preview-gc", {});

      if (opts.json && !opts.yes) {
        process.stdout.write(JSON.stringify({ preview }, null, 2) + "\n");
        console.error(kleur.yellow("Re-run with --yes to commit."));
        return;
      }

      if (!opts.json) {
        console.log(
          kleur.yellow(
            `Preview — ${preview.plan.length} orphan folder(s) will be removed (${formatKb(preview.reclaimableKb)}):`,
          ),
        );
        for (const p of preview.plan) {
          console.log(`  ${p.folderName}  (${formatKb(p.sizeKb)})`);
        }
      }

      if (!opts.yes) {
        console.error(kleur.yellow("Re-run with --yes to commit."));
        return;
      }

      const result = await post<{ results: GcResult[]; reclaimedKb: number }>(
        "/extensions/gc",
        { token: preview.token },
      );

      if (opts.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        return;
      }

      const ok = result.results.filter((r) => r.ok).length;
      const failed = result.results.length - ok;
      console.log(
        failed === 0
          ? kleur.green(`✓ removed ${ok} folder(s), reclaimed ${formatKb(result.reclaimedKb)}`)
          : kleur.yellow(`removed ${ok}, failed ${failed} (${formatKb(result.reclaimedKb)} reclaimed)`),
      );
      for (const r of result.results) {
        if (!r.ok) {
          console.log(`  ${kleur.red("✗")} ${r.folderName}  ${r.error ?? ""}`);
        }
      }
    });

  return cmd;
}
