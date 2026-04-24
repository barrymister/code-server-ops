import { describe, it, expect } from "vitest";
import { parseJournalctlLines } from "../src/collectors/journalctl.js";

describe("parseJournalctlLines", () => {
  it("extracts pid + comm + timestamp from oom-kill lines", () => {
    const sample = `2026-04-24T12:34:56+00:00 host kernel: Out of memory: Killed process 12345 (node) total-vm:...
2026-04-24T12:35:01+00:00 host kernel: some unrelated line
2026-04-24T13:00:00+00:00 host kernel: Out of memory: Killed process 98765 (electron) total-vm:...`;

    const events = parseJournalctlLines(sample);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      pid: 12345,
      comm: "node",
      timestamp: "2026-04-24T12:34:56+00:00",
    });
    expect(events[1]).toMatchObject({ pid: 98765, comm: "electron" });
  });

  it("returns empty array on input with no oom lines", () => {
    expect(parseJournalctlLines("nothing here\nnor here")).toEqual([]);
  });
});
