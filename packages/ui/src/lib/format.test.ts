import { describe, it, expect } from "vitest";
import { formatDuration, formatKb, formatTime } from "./format.js";

describe("formatKb", () => {
  it("uses KB under 1024", () => {
    expect(formatKb(512)).toBe("512 KB");
  });
  it("uses MB for mid sizes", () => {
    expect(formatKb(2048)).toBe("2.0 MB");
  });
  it("uses GB for large sizes", () => {
    expect(formatKb(5 * 1024 * 1024)).toBe("5.00 GB");
  });
});

describe("formatDuration", () => {
  it("uses seconds under a minute", () => {
    expect(formatDuration(45)).toBe("45s");
  });
  it("uses minutes", () => {
    expect(formatDuration(120)).toBe("2m");
  });
  it("uses hours with leftover minutes", () => {
    expect(formatDuration(3600 + 15 * 60)).toBe("1h 15m");
  });
  it("uses days with leftover hours", () => {
    expect(formatDuration(2 * 86_400 + 3 * 3600)).toBe("2d 3h");
  });
});

describe("formatTime", () => {
  it("returns HH:MM:SS format", () => {
    // 2026-04-24T15:30:45Z — just verify output contains colons and digits.
    const s = formatTime("2026-04-24T15:30:45.000Z");
    expect(s).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});
