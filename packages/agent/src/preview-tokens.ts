// Preview-token cache for the Preview→Confirm mutation pattern.
//
// A mutation cannot fire unless the caller first fetches a preview and then
// passes the token back with the commit. This blocks stale-tab drive-bys:
// the server re-validates the plan (PIDs still orphan, folders still absent
// from extensions.json, etc.) at preview time and again at commit time.

import { randomBytes } from "node:crypto";

export type MutationKind =
  | "terminals.kill"
  | "extensions.gc"
  | "memory.restart-ext-host"
  | "ai-processes.kill";

export interface PreviewRecord<TPlan = unknown> {
  kind: MutationKind;
  plan: TPlan;
  createdAt: number;
  expiresAt: number;
}

const TTL_MS = 60_000;
const store = new Map<string, PreviewRecord>();

export function issuePreview<TPlan>(kind: MutationKind, plan: TPlan): string {
  const token = randomBytes(16).toString("hex");
  const now = Date.now();
  store.set(token, {
    kind,
    plan,
    createdAt: now,
    expiresAt: now + TTL_MS,
  });
  return token;
}

export function consumePreview<TPlan>(
  token: string,
  kind: MutationKind,
): TPlan | null {
  const rec = store.get(token);
  if (!rec) return null;
  if (rec.kind !== kind) return null;
  if (Date.now() > rec.expiresAt) {
    store.delete(token);
    return null;
  }
  store.delete(token);
  return rec.plan as TPlan;
}

export function __clearPreviewsForTests(): void {
  store.clear();
}

export function __sizeForTests(): number {
  // Drop expired entries first so tests can observe real live count.
  const now = Date.now();
  for (const [t, rec] of store) {
    if (now > rec.expiresAt) store.delete(t);
  }
  return store.size;
}
