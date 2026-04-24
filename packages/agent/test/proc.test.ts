import { describe, it, expect } from "vitest";
import { ageSeconds, startTimeToIso } from "../src/collectors/proc.js";

describe("startTimeToIso", () => {
  it("converts btime + clock ticks to an ISO timestamp", () => {
    const btime = 1_700_000_000; // arbitrary
    const ticks = 6000; // 60s @ 100 ticks/s
    const iso = startTimeToIso(btime, ticks);
    const expected = new Date((btime + 60) * 1000).toISOString();
    expect(iso).toBe(expected);
  });
});

describe("ageSeconds", () => {
  it("returns a non-negative integer", () => {
    const now = Math.floor(Date.now() / 1000);
    const btime = now - 3600; // booted 1h ago
    const age = ageSeconds(btime, 0);
    expect(age).toBeGreaterThanOrEqual(3600 - 1);
    expect(Number.isInteger(age)).toBe(true);
  });

  it("clamps negative results to 0", () => {
    const future = Math.floor(Date.now() / 1000) + 10_000;
    expect(ageSeconds(future, 0)).toBe(0);
  });
});
