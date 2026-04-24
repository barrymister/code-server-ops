import { Command } from "commander";
import kleur from "kleur";
import { get } from "../client.js";
import { formatKb } from "../format.js";

interface MemorySample {
  timestamp: string;
  extHostPid: number | null;
  rssKb: number;
  heapUsedKb: number | null;
}

interface MemorySnapshot {
  current: MemorySample;
  series: MemorySample[];
}

export function memoryCommand(): Command {
  const cmd = new Command("memory").description(
    "Inspect the code-server extension host process memory.",
  );

  cmd
    .command("show")
    .description("Print current extension host RSS snapshot")
    .option("--json", "emit JSON")
    .action(async (opts: { json?: boolean }) => {
      const snap = await get<MemorySnapshot>("/memory");
      if (opts.json) {
        process.stdout.write(JSON.stringify(snap, null, 2) + "\n");
        return;
      }
      const { current } = snap;
      console.log(
        `ext-host pid=${current.extHostPid ?? "n/a"}  rss=${formatKb(current.rssKb)}  samples=${snap.series.length}`,
      );
    });

  cmd
    .command("watch")
    .description("Poll /memory on an interval and print a running line per sample")
    .option("-i, --interval <seconds>", "poll interval", "5")
    .action(async (opts: { interval: string }) => {
      const intervalMs = Math.max(1, Number.parseInt(opts.interval, 10)) * 1000;
      console.log(kleur.dim(`watching every ${intervalMs / 1000}s. Ctrl-C to stop.`));
      const tick = async (): Promise<void> => {
        try {
          const snap = await get<MemorySnapshot>("/memory");
          const { current } = snap;
          console.log(
            `${current.timestamp}  pid=${current.extHostPid ?? "n/a"}  rss=${formatKb(current.rssKb)}`,
          );
        } catch (err) {
          console.error(kleur.red(String(err)));
        }
      };
      await tick();
      setInterval(tick, intervalMs);
    });

  return cmd;
}
