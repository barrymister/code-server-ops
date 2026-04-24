import { Command } from "commander";
import kleur from "kleur";
import { get } from "../client.js";
import { formatKb } from "../format.js";

interface ExtensionInfo {
  name: string;
  version: string;
  sizeKb: number;
  registered: boolean;
  orphan: boolean;
  multiVersionPeers: string[];
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
    .description("Preview orphan extension folders that would be removed")
    .option("--json", "emit JSON")
    .action(async (opts: { json?: boolean }) => {
      const exts = await get<ExtensionInfo[]>("/extensions");
      const orphans = exts.filter((e) => e.orphan);
      const totalKb = orphans.reduce((sum, e) => sum + e.sizeKb, 0);

      if (opts.json) {
        process.stdout.write(
          JSON.stringify({ orphans, reclaimable: totalKb }, null, 2) + "\n",
        );
        return;
      }

      console.log(
        kleur.yellow(
          "Preview mode — mutation endpoints land in v0.1.0. These folders would be removed:",
        ),
      );
      for (const e of orphans) {
        console.log(`  ${e.name}-${e.version}  (${formatKb(e.sizeKb)})`);
      }
      console.log(kleur.bold(`Reclaimable: ${formatKb(totalKb)}`));
    });

  return cmd;
}
