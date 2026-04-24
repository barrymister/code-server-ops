import { describe, it, expect } from "vitest";
import { findPtyHost, isShellIntegrationBash } from "../src/routes/terminals.js";
import type { ProcEntry } from "../src/collectors/proc.js";

function mkProc(partial: Partial<ProcEntry>): ProcEntry {
  return {
    pid: 1,
    cmdline: [],
    comm: "",
    ppid: 0,
    startTimeTicks: 0,
    rssKb: 0,
    cwd: null,
    ...partial,
  };
}

describe("isShellIntegrationBash", () => {
  it("matches code-server shellIntegration-bash command", () => {
    expect(
      isShellIntegrationBash(
        mkProc({
          cmdline: [
            "/usr/bin/bash",
            "--init-file",
            "/vscode/shellIntegration-bash.sh",
          ],
        }),
      ),
    ).toBe(true);
  });

  it("does not match plain bash", () => {
    expect(
      isShellIntegrationBash(mkProc({ cmdline: ["/usr/bin/bash", "-l"] })),
    ).toBe(false);
  });
});

describe("findPtyHost", () => {
  it("finds ptyHost by --type flag", () => {
    const procs = [
      mkProc({ pid: 10, cmdline: ["node", "/code-server", "--type=extensionHost"] }),
      mkProc({ pid: 11, cmdline: ["node", "/code-server", "--type=ptyHost"] }),
      mkProc({ pid: 12, cmdline: ["/usr/bin/bash"] }),
    ];
    expect(findPtyHost(procs)).toBe(11);
  });

  it("returns null when absent", () => {
    expect(findPtyHost([mkProc({ pid: 1, cmdline: ["/usr/bin/bash"] })])).toBeNull();
  });
});
