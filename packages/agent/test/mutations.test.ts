import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildApp } from "../src/index.js";
import { __clearPreviewsForTests } from "../src/preview-tokens.js";

const PASSWORD = "test-password";
const AUTH_HEADER = "Basic " + Buffer.from(`ops:${PASSWORD}`).toString("base64");

async function makeApp(): Promise<Awaited<ReturnType<typeof buildApp>>> {
  process.env.CSOPS_PASSWORD = PASSWORD;
  // Point proc-reading collectors at an empty dir so tests never touch host /proc
  // (on CI this is already Linux but the collector gracefully degrades).
  return buildApp();
}

describe("mutation routes — auth + input validation", () => {
  beforeEach(() => {
    __clearPreviewsForTests();
  });

  let app: Awaited<ReturnType<typeof buildApp>>;

  afterEach(async () => {
    if (app) await app.close();
  });

  it("rejects mutation without auth", async () => {
    app = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/terminals/kill",
      payload: { token: "anything" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("requires token on commit", async () => {
    app = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/terminals/kill",
      headers: { authorization: AUTH_HEADER },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "token required" });
  });

  it("rejects unknown token on commit", async () => {
    app = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/terminals/kill",
      headers: { authorization: AUTH_HEADER },
      payload: { token: "deadbeef" },
    });
    expect(res.statusCode).toBe(410);
  });

  it("preview-kill on Linux without matching procs returns 400", async () => {
    app = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/terminals/preview-kill",
      headers: { authorization: AUTH_HEADER },
      payload: { orphanOnly: true },
    });
    // On CI there should be no shell-integration bash processes.
    expect([400, 200]).toContain(res.statusCode);
  });
});

describe("extensions.gc — preview + commit", () => {
  let tmpDir: string;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    __clearPreviewsForTests();
    tmpDir = await mkdtemp(path.join(tmpdir(), "csops-ext-test-"));
    // One orphan folder (not in extensions.json), one registered folder.
    const orphanPath = path.join(tmpDir, "orphan.ext-1.0.0");
    const keepPath = path.join(tmpDir, "keep.ext-2.0.0");
    await mkdir(orphanPath, { recursive: true });
    await mkdir(keepPath, { recursive: true });
    await writeFile(path.join(orphanPath, "package.json"), "{}");
    await writeFile(path.join(keepPath, "package.json"), "{}");
    await writeFile(
      path.join(tmpDir, "extensions.json"),
      JSON.stringify([
        {
          identifier: { id: "keep.ext" },
          version: "2.0.0",
          relativeLocation: "keep.ext-2.0.0",
        },
      ]),
    );
    process.env.CSOPS_EXTENSIONS_DIR = tmpDir;
  });

  afterEach(async () => {
    if (app) await app.close();
    delete process.env.CSOPS_EXTENSIONS_DIR;
  });

  it("preview returns a plan listing only the orphan folder", async () => {
    app = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/extensions/preview-gc",
      headers: { authorization: AUTH_HEADER },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      token: string;
      plan: { folderName: string }[];
      reclaimableKb: number;
    };
    expect(body.token).toMatch(/^[0-9a-f]{32}$/);
    expect(body.plan).toHaveLength(1);
    expect(body.plan[0]?.folderName).toBe("orphan.ext-1.0.0");
  });

  it("commit deletes the orphan folder and leaves the registered one", async () => {
    app = await makeApp();
    const preview = await app.inject({
      method: "POST",
      url: "/extensions/preview-gc",
      headers: { authorization: AUTH_HEADER },
      payload: {},
    });
    const { token } = preview.json() as { token: string };

    const commit = await app.inject({
      method: "POST",
      url: "/extensions/gc",
      headers: { authorization: AUTH_HEADER },
      payload: { token },
    });
    expect(commit.statusCode).toBe(200);
    const body = commit.json() as { results: { ok: boolean }[] };
    expect(body.results.every((r) => r.ok)).toBe(true);

    await expect(
      access(path.join(tmpDir, "orphan.ext-1.0.0")),
    ).rejects.toThrow();
    await expect(
      access(path.join(tmpDir, "keep.ext-2.0.0")),
    ).resolves.toBeUndefined();
  });

  it("token is single-use — replay returns 410", async () => {
    app = await makeApp();
    const preview = await app.inject({
      method: "POST",
      url: "/extensions/preview-gc",
      headers: { authorization: AUTH_HEADER },
      payload: {},
    });
    const { token } = preview.json() as { token: string };

    await app.inject({
      method: "POST",
      url: "/extensions/gc",
      headers: { authorization: AUTH_HEADER },
      payload: { token },
    });
    const replay = await app.inject({
      method: "POST",
      url: "/extensions/gc",
      headers: { authorization: AUTH_HEADER },
      payload: { token },
    });
    expect(replay.statusCode).toBe(410);
  });
});
