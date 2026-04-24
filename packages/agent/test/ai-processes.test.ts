import { describe, it, expect } from "vitest";
import { findExtensionHost } from "../src/routes/ai-processes.js";
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

describe("findExtensionHost", () => {
  it("finds extension host by --type=extensionHost flag", () => {
    const procs = [
      mkProc({ pid: 5, cmdline: ["node", "/code-server", "--type=extensionHost"] }),
      mkProc({ pid: 6, cmdline: ["bash"] }),
    ];
    expect(findExtensionHost(procs)).toBe(5);
  });

  it("returns null when no extension host present", () => {
    expect(findExtensionHost([mkProc({ pid: 1, cmdline: ["bash"] })])).toBeNull();
  });
});
