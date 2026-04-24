import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import type { ExtensionInfo, ExtensionsGcPreview } from "../lib/types.js";
import { formatKb } from "../lib/format.js";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Spinner,
  Table,
  Td,
  Th,
} from "../components/primitives.js";

export function ExtensionsPanel() {
  const [rows, setRows] = useState<ExtensionInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [orphanOnly, setOrphanOnly] = useState(false);
  const [preview, setPreview] = useState<ExtensionsGcPreview | null>(null);
  const [committing, setCommitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ExtensionInfo[]>("/extensions");
      setRows(data);
    } catch (err) {
      setError(describe(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return orphanOnly ? rows.filter((r) => r.orphan) : rows;
  }, [rows, orphanOnly]);

  const orphanCount = rows?.filter((r) => r.orphan).length ?? 0;
  const orphanBytes = rows
    ? rows.filter((r) => r.orphan).reduce((sum, r) => sum + r.sizeKb, 0)
    : 0;

  const previewGc = async (folders?: string[]) => {
    try {
      const result = await api.post<ExtensionsGcPreview>("/extensions/preview-gc", {
        folders,
      });
      setPreview(result);
    } catch (err) {
      setError(describe(err));
    }
  };

  const commit = async () => {
    if (!preview) return;
    setCommitting(true);
    try {
      await api.post("/extensions/gc", { token: preview.token });
      setPreview(null);
      await refresh();
    } catch (err) {
      setError(describe(err));
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Card
      title="Extension Folder Explorer"
      description="Upstream never rm -rf's extension folders on uninstall or auto-update. They accumulate forever."
      action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => previewGc()}
            disabled={orphanCount === 0}
          >
            GC all orphans ({formatKb(orphanBytes)})
          </Button>
        </div>
      }
    >
      <div className="mb-3 flex items-center gap-2">
        <Button
          size="sm"
          variant={orphanOnly ? "default" : "outline"}
          onClick={() => setOrphanOnly((v) => !v)}
        >
          Orphans only
        </Button>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-800 bg-red-950/30 p-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && !rows ? (
        <Spinner label="Scanning extensions…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={orphanOnly ? "No orphan folders" : "No extensions found"}
          description={
            orphanOnly
              ? "Every folder on disk is registered in extensions.json."
              : "Verify CSOPS_EXTENSIONS_DIR points to the right path."
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Version</Th>
              <Th>Size</Th>
              <Th>Registered</Th>
              <Th>Multi-version</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const folderName = r.version === "unknown" ? r.name : `${r.name}-${r.version}`;
              return (
                <tr key={folderName} className="hover:bg-zinc-900/60">
                  <Td className="font-mono text-xs">{r.name}</Td>
                  <Td className="font-mono text-xs text-zinc-400">{r.version}</Td>
                  <Td>{formatKb(r.sizeKb)}</Td>
                  <Td>
                    {r.registered ? (
                      <Badge tone="green">yes</Badge>
                    ) : (
                      <Badge tone="red">orphan</Badge>
                    )}
                  </Td>
                  <Td>
                    {r.multiVersionPeers.length > 0 ? (
                      <Badge tone="amber">+{r.multiVersionPeers.length}</Badge>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </Td>
                  <Td>
                    {r.orphan && (
                      <Button size="sm" variant="ghost" onClick={() => previewGc([folderName])}>
                        Delete
                      </Button>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <Dialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        title="Confirm: garbage-collect extensions"
        description={`${preview?.plan.length ?? 0} folder${preview?.plan.length === 1 ? "" : "s"} will be removed (${formatKb(preview?.reclaimableKb ?? 0)}).`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPreview(null)} disabled={committing}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={commit} disabled={committing}>
              {committing ? "Deleting…" : "Delete now"}
            </Button>
          </>
        }
      >
        {preview && (
          <Table>
            <thead>
              <tr>
                <Th>Folder</Th>
                <Th>Size</Th>
              </tr>
            </thead>
            <tbody>
              {preview.plan.map((p) => (
                <tr key={p.folderName}>
                  <Td className="font-mono text-xs">{p.folderName}</Td>
                  <Td>{formatKb(p.sizeKb)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Dialog>
    </Card>
  );
}

function describe(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return err instanceof Error ? err.message : String(err);
}
