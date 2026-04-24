import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { ExtensionInfo } from "../types.js";

const DEFAULT_DIR = "/home/coder/.local/share/code-server/extensions";

interface ExtensionsJsonEntry {
  identifier?: { id?: string };
  version?: string;
  relativeLocation?: string;
}

export async function collectExtensions(): Promise<ExtensionInfo[]> {
  const dir = process.env.CSOPS_EXTENSIONS_DIR ?? DEFAULT_DIR;

  const [registeredSet, folders] = await Promise.all([
    readRegistered(dir),
    listFolders(dir),
  ]);

  const infos: ExtensionInfo[] = [];
  const byName = new Map<string, ExtensionInfo[]>();

  for (const folder of folders) {
    const { name, version } = parseFolderName(folder);
    const fullPath = path.join(dir, folder);
    const sizeKb = await dirSizeKb(fullPath);
    const registered = registeredSet.has(folder);

    const info: ExtensionInfo = {
      name,
      version,
      sizeKb,
      registered,
      orphan: !registered,
      multiVersionPeers: [],
    };
    infos.push(info);

    if (!byName.has(name)) byName.set(name, []);
    byName.get(name)!.push(info);
  }

  for (const [, peers] of byName) {
    if (peers.length > 1) {
      const allFolderNames = peers.map((p) => `${p.name}-${p.version}`);
      for (const peer of peers) {
        peer.multiVersionPeers = allFolderNames.filter(
          (f) => f !== `${peer.name}-${peer.version}`,
        );
      }
    }
  }

  return infos;
}

async function readRegistered(dir: string): Promise<Set<string>> {
  const registered = new Set<string>();
  try {
    const raw = await readFile(path.join(dir, "extensions.json"), "utf8");
    const json = JSON.parse(raw) as ExtensionsJsonEntry[];
    for (const entry of json) {
      if (entry.relativeLocation) registered.add(entry.relativeLocation);
    }
  } catch {
    // extensions.json missing or unreadable — everything looks orphan
  }
  return registered;
}

async function listFolders(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

function parseFolderName(folder: string): { name: string; version: string } {
  // VSCode folder naming: <publisher>.<name>-<version>
  const m = folder.match(/^(.+?)-(\d+\.\d+\.\d+.*)$/);
  if (m) {
    return { name: m[1] ?? folder, version: m[2] ?? "unknown" };
  }
  return { name: folder, version: "unknown" };
}

async function dirSizeKb(dir: string): Promise<number> {
  let total = 0;
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += (await dirSizeKb(full)) * 1024;
      } else if (entry.isFile()) {
        const s = await stat(full);
        total += s.size;
      }
    }
  } catch {
    // ignore unreadable subtrees
  }
  return Math.round(total / 1024);
}
