// code-server-ops-cli
//
// Terminal client for the code-server-ops-agent REST endpoints.
// Cron-friendly with --json; human-readable by default.

import { Command } from "commander";
import { terminalsCommand } from "./commands/terminals.js";
import { extensionsCommand } from "./commands/extensions.js";
import { memoryCommand } from "./commands/memory.js";

const VERSION = "0.1.0";

function main(): void {
  const program = new Command();
  program
    .name("csops")
    .description(
      "code-server-ops CLI — inspect terminals, extensions, and memory on a self-hosted code-server.",
    )
    .version(VERSION);

  program.addCommand(terminalsCommand());
  program.addCommand(extensionsCommand());
  program.addCommand(memoryCommand());

  program.parseAsync(process.argv).catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}

main();
