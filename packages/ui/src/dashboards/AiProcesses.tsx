import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import type { AiKillPreview, AiProcessInfo } from "../lib/types.js";
import { formatDuration, formatKb } from "../lib/format.js";
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

export function AiProcessesPanel() {
  const [rows, setRows] = useState<AiProcessInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<AiKillPreview | null>(null);
  const [committing, setCommitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<AiProcessInfo[]>("/ai-processes");
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

  const duplicateExts = useMemo(() => {
    if (!rows) return new Set<string>();
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.extension, (counts.get(r.extension) ?? 0) + 1);
    return new Set(Array.from(counts).filter(([, n]) => n > 1).map(([ext]) => ext));
  }, [rows]);

  const previewOne = async (pid: number) => {
    try {
      const result = await api.post<AiKillPreview>("/ai-processes/preview-kill", {
        pids: [pid],
      });
      setPreview(result);
    } catch (err) {
      setError(describe(err));
    }
  };

  const previewDuplicates = async () => {
    try {
      const result = await api.post<AiKillPreview>("/ai-processes/preview-kill", {
        duplicatesOnly: true,
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
      await api.post("/ai-processes/kill", { token: preview.token });
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
      title="AI Process Watcher"
      description="AI assistant extensions (Claude Code, Copilot, Continue, Cline, Codex). Auto-resumed ghosts after reconnect are a common memory sink."
      action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={previewDuplicates}
            disabled={duplicateExts.size === 0}
          >
            Kill duplicates ({duplicateExts.size})
          </Button>
        </div>
      }
    >
      {error && (
        <div className="mb-3 rounded-md border border-red-800 bg-red-950/30 p-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && !rows ? (
        <Spinner label="Scanning processes…" />
      ) : !rows || rows.length === 0 ? (
        <EmptyState
          title="No AI processes detected"
          description="No Claude Code / Copilot / Continue / Cline / Codex binaries are running."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>PID</Th>
              <Th>Extension</Th>
              <Th>Uptime</Th>
              <Th>RSS</Th>
              <Th>Conversation</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.pid} className="hover:bg-zinc-900/60">
                <Td className="font-mono">{r.pid}</Td>
                <Td>
                  <Badge tone="blue">{r.extension}</Badge>
                  {duplicateExts.has(r.extension) && (
                    <Badge tone="amber" className="ml-1">dup</Badge>
                  )}
                </Td>
                <Td>{formatDuration(r.uptimeSeconds)}</Td>
                <Td className="text-zinc-400">{formatKb(r.rssKb)}</Td>
                <Td className="font-mono text-xs text-zinc-500">
                  {r.conversationId ?? "-"}
                </Td>
                <Td>
                  <Button size="sm" variant="ghost" onClick={() => previewOne(r.pid)}>
                    Kill
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Dialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        title="Confirm: kill AI processes"
        description={`${preview?.plan.length ?? 0} process${preview?.plan.length === 1 ? "" : "es"} will be sent SIGTERM.`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPreview(null)} disabled={committing}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={commit} disabled={committing}>
              {committing ? "Killing…" : "Kill now"}
            </Button>
          </>
        }
      >
        {preview && (
          <Table>
            <thead>
              <tr>
                <Th>PID</Th>
                <Th>Extension</Th>
                <Th>Uptime</Th>
                <Th>RSS</Th>
              </tr>
            </thead>
            <tbody>
              {preview.plan.map((p) => (
                <tr key={p.pid}>
                  <Td className="font-mono">{p.pid}</Td>
                  <Td>{p.extension}</Td>
                  <Td>{formatDuration(p.uptimeSeconds)}</Td>
                  <Td>{formatKb(p.rssKb)}</Td>
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
