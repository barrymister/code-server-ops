import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import type { TerminalInfo, TerminalKillPreview } from "../lib/types.js";
import { formatDuration, formatKb, formatTime } from "../lib/format.js";
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

const AGE_BUCKETS = [
  { label: "All", seconds: 0 },
  { label: "> 1h", seconds: 3600 },
  { label: "> 24h", seconds: 86_400 },
  { label: "> 7d", seconds: 7 * 86_400 },
];

export function TerminalsPanel() {
  const [rows, setRows] = useState<TerminalInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ageFilter, setAgeFilter] = useState(0);
  const [orphanOnly, setOrphanOnly] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [preview, setPreview] = useState<TerminalKillPreview | null>(null);
  const [committing, setCommitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<TerminalInfo[]>("/terminals");
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
    return rows.filter((r) => {
      if (orphanOnly && r.attached) return false;
      if (ageFilter > 0 && r.ageSeconds < ageFilter) return false;
      return true;
    });
  }, [rows, ageFilter, orphanOnly]);

  const toggle = (pid: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const previewSelected = async () => {
    if (selected.size === 0) return;
    try {
      const result = await api.post<TerminalKillPreview>("/terminals/preview-kill", {
        pids: Array.from(selected),
      });
      setPreview(result);
    } catch (err) {
      setError(describe(err));
    }
  };

  const previewOrphansBulk = async () => {
    try {
      const result = await api.post<TerminalKillPreview>("/terminals/preview-kill", {
        orphanOnly: true,
        olderThanSeconds: ageFilter,
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
      await api.post("/terminals/kill", { token: preview.token });
      setPreview(null);
      setSelected(new Set());
      await refresh();
    } catch (err) {
      setError(describe(err));
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Card
      title="Terminal Inspector"
      description="code-server bash shell-integration processes. Orphans keep accumulating when tabs close without typing exit."
      action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={previewOrphansBulk}
            disabled={!rows || rows.every((r) => r.attached)}
          >
            Kill orphans…
          </Button>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-zinc-500">Age</span>
        {AGE_BUCKETS.map((b) => (
          <Button
            key={b.label}
            size="sm"
            variant={ageFilter === b.seconds ? "default" : "outline"}
            onClick={() => setAgeFilter(b.seconds)}
          >
            {b.label}
          </Button>
        ))}
        <div className="mx-1 h-4 w-px bg-zinc-700" />
        <Button
          size="sm"
          variant={orphanOnly ? "default" : "outline"}
          onClick={() => setOrphanOnly((v) => !v)}
        >
          Orphans only
        </Button>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="danger"
          disabled={selected.size === 0}
          onClick={previewSelected}
        >
          Kill selected ({selected.size})
        </Button>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-800 bg-red-950/30 p-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && !rows ? (
        <Spinner label="Loading terminals…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No matching terminals"
          description="Your end-of-day hygiene is paying off."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th className="w-6" />
              <Th>PID</Th>
              <Th>Started</Th>
              <Th>Age</Th>
              <Th>RSS</Th>
              <Th>Attached</Th>
              <Th>CWD</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.pid} className="hover:bg-zinc-900/60">
                <Td>
                  <input
                    type="checkbox"
                    checked={selected.has(r.pid)}
                    onChange={() => toggle(r.pid)}
                  />
                </Td>
                <Td className="font-mono">{r.pid}</Td>
                <Td className="text-zinc-400">{formatTime(r.lstart)}</Td>
                <Td>{formatDuration(r.ageSeconds)}</Td>
                <Td className="text-zinc-400">{formatKb(r.rssKb)}</Td>
                <Td>
                  {r.attached ? (
                    <Badge tone="green">attached</Badge>
                  ) : (
                    <Badge tone="red">orphan</Badge>
                  )}
                </Td>
                <Td className="max-w-xs truncate font-mono text-xs text-zinc-500">
                  {r.cwd ?? "-"}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Dialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        title="Confirm: kill terminals"
        description={`${preview?.plan.length ?? 0} process${preview?.plan.length === 1 ? "" : "es"} will be sent SIGKILL.`}
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
                <Th>Age</Th>
                <Th>RSS</Th>
                <Th>Attached</Th>
                <Th>CWD</Th>
              </tr>
            </thead>
            <tbody>
              {preview.plan.map((p) => (
                <tr key={p.pid}>
                  <Td className="font-mono">{p.pid}</Td>
                  <Td>{formatDuration(p.ageSeconds)}</Td>
                  <Td className="text-zinc-400">{formatKb(p.rssKb)}</Td>
                  <Td>
                    {p.attached ? (
                      <Badge tone="green">attached</Badge>
                    ) : (
                      <Badge tone="red">orphan</Badge>
                    )}
                  </Td>
                  <Td className="max-w-xs truncate font-mono text-xs text-zinc-500">
                    {p.cwd ?? "-"}
                  </Td>
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
