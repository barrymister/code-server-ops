import { rm } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { collectExtensions } from "../collectors/extensions.js";
import { consumePreview, issuePreview } from "../preview-tokens.js";
import type { ExtensionInfo } from "../types.js";

interface GcPreviewBody {
  folders?: unknown;
}

interface GcCommitBody {
  token?: unknown;
}

interface GcPlanEntry {
  folderName: string;
  name: string;
  version: string;
  sizeKb: number;
  absolutePath: string;
}

interface GcResult {
  folderName: string;
  ok: boolean;
  reclaimedKb: number;
  error?: string;
}

const DEFAULT_DIR = "/home/coder/.local/share/code-server/extensions";

function extensionsDir(): string {
  return process.env.CSOPS_EXTENSIONS_DIR ?? DEFAULT_DIR;
}

export async function extensionsRoute(app: FastifyInstance): Promise<void> {
  app.get("/extensions", async () => collectExtensions());

  app.post("/extensions/preview-gc", async (req, reply) => {
    const body = (req.body ?? {}) as GcPreviewBody;
    const requestedFolders = parseStringArray(body.folders);
    const exts = await collectExtensions();

    const orphans = exts.filter((e) => e.orphan);
    const target = requestedFolders === null
      ? orphans
      : orphans.filter((e) => requestedFolders.includes(folderName(e)));

    if (target.length === 0) {
      reply.code(400);
      return { error: "no orphan extension folders match the requested plan" };
    }

    const dir = extensionsDir();
    const plan: GcPlanEntry[] = target.map((e) => ({
      folderName: folderName(e),
      name: e.name,
      version: e.version,
      sizeKb: e.sizeKb,
      absolutePath: path.join(dir, folderName(e)),
    }));

    const totalKb = plan.reduce((sum, p) => sum + p.sizeKb, 0);
    const token = issuePreview("extensions.gc", plan);
    return { token, plan, reclaimableKb: totalKb, ttlSeconds: 60 };
  });

  app.post("/extensions/gc", async (req, reply) => {
    const body = (req.body ?? {}) as GcCommitBody;
    if (typeof body.token !== "string" || body.token.length === 0) {
      reply.code(400);
      return { error: "token required" };
    }

    const plan = consumePreview<GcPlanEntry[]>(body.token, "extensions.gc");
    if (!plan) {
      reply.code(410);
      return { error: "preview expired or unknown token — re-run preview" };
    }

    // Revalidate — only allow deletion of folders still reported as orphan.
    const currentOrphans = new Set(
      (await collectExtensions())
        .filter((e) => e.orphan)
        .map((e) => folderName(e)),
    );

    const dir = extensionsDir();
    const results: GcResult[] = [];
    for (const entry of plan) {
      if (!currentOrphans.has(entry.folderName)) {
        results.push({
          folderName: entry.folderName,
          ok: false,
          reclaimedKb: 0,
          error: "no longer orphan — aborted",
        });
        continue;
      }
      if (!isSafePath(dir, entry.absolutePath)) {
        results.push({
          folderName: entry.folderName,
          ok: false,
          reclaimedKb: 0,
          error: "rejected path outside extensions dir",
        });
        continue;
      }
      try {
        await rm(entry.absolutePath, { recursive: true, force: true });
        results.push({
          folderName: entry.folderName,
          ok: true,
          reclaimedKb: entry.sizeKb,
        });
      } catch (err) {
        results.push({
          folderName: entry.folderName,
          ok: false,
          reclaimedKb: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const totalReclaimed = results.reduce((sum, r) => sum + r.reclaimedKb, 0);
    return { results, reclaimedKb: totalReclaimed };
  });
}

function folderName(e: ExtensionInfo): string {
  return e.version === "unknown" ? e.name : `${e.name}-${e.version}`;
}

function parseStringArray(v: unknown): string[] | null {
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v)) return null;
  return v.filter((x): x is string => typeof x === "string" && x.length > 0);
}

function isSafePath(dir: string, target: string): boolean {
  const normDir = path.resolve(dir);
  const normTarget = path.resolve(target);
  if (normTarget === normDir) return false;
  const rel = path.relative(normDir, normTarget);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return false;
  // Refuse nested subpaths — we only delete top-level orphan folders.
  if (rel.includes(path.sep)) return false;
  return true;
}
