import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  issuePreview,
  consumePreview,
  __clearPreviewsForTests,
  __sizeForTests,
} from "../src/preview-tokens.js";

describe("preview-tokens", () => {
  beforeEach(() => {
    __clearPreviewsForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("issues a token and returns the plan on consume", () => {
    const token = issuePreview("terminals.kill", [{ pid: 42 }]);
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    const plan = consumePreview<{ pid: number }[]>(token, "terminals.kill");
    expect(plan).toEqual([{ pid: 42 }]);
  });

  it("consume is single-use — second call returns null", () => {
    const token = issuePreview("terminals.kill", []);
    expect(consumePreview(token, "terminals.kill")).not.toBeNull();
    expect(consumePreview(token, "terminals.kill")).toBeNull();
  });

  it("consume returns null when kind mismatches", () => {
    const token = issuePreview("extensions.gc", []);
    expect(consumePreview(token, "terminals.kill")).toBeNull();
  });

  it("consume returns null after TTL expires", () => {
    vi.useFakeTimers();
    const token = issuePreview("terminals.kill", []);
    vi.advanceTimersByTime(61_000);
    expect(consumePreview(token, "terminals.kill")).toBeNull();
  });

  it("returns null for unknown tokens", () => {
    expect(consumePreview("nope", "terminals.kill")).toBeNull();
  });

  it("size drops expired entries lazily", () => {
    vi.useFakeTimers();
    issuePreview("terminals.kill", []);
    issuePreview("extensions.gc", []);
    expect(__sizeForTests()).toBe(2);
    vi.advanceTimersByTime(61_000);
    expect(__sizeForTests()).toBe(0);
  });
});
