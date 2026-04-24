import { describe, it, expect } from "vitest";
import { formatDuration, formatKb, parseDuration } from "../src/format.js";

describe("formatDuration", () => {
  it("formats seconds", () => {
    expect(formatDuration(45)).toBe("45s");
  });
  it("formats minutes", () => {
    expect(formatDuration(120)).toBe("2m");
  });
  it("formats hours and minutes", () => {
    expect(formatDuration(3665)).toBe("1h1m");
  });
  it("formats days and hours", () => {
    expect(formatDuration(90000)).toBe("1d1h");
  });
});

describe("formatKb", () => {
  it("keeps KB under 1024", () => {
    expect(formatKb(512)).toBe("512 KB");
  });
  it("converts to MB", () => {
    expect(formatKb(2048)).toBe("2.0 MB");
  });
  it("converts to GB", () => {
    expect(formatKb(3 * 1024 * 1024)).toBe("3.00 GB");
  });
});

describe("parseDuration", () => {
  it("parses hours", () => {
    expect(parseDuration("24h")).toBe(86400);
  });
  it("parses days", () => {
    expect(parseDuration("7d")).toBe(604800);
  });
  it("throws on bad input", () => {
    expect(() => parseDuration("lol")).toThrow();
  });
});
