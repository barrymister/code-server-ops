import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../lib/api.js";
import type {
  MemorySnapshot,
  OomEvent,
  RestartExtHostPreview,
} from "../lib/types.js";
import { formatKb, formatTime } from "../lib/format.js";
import {
  Button,
  Card,
  Dialog,
  EmptyState,
  Spinner,
} from "../components/primitives.js";

export function MemoryTimelinePanel() {
  const [snap, setSnap] = useState<MemorySnapshot | null>(null);
  const [ooms, setOoms] = useState<OomEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<RestartExtHostPreview | null>(null);
  const [committing, setCommitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, o] = await Promise.all([
        api.get<MemorySnapshot>("/memory"),
        api.get<OomEvent[]>("/oom-events?window=86400"),
      ]);
      setSnap(s);
      setOoms(o);
    } catch (err) {
      setError(describe(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const iv = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(iv);
  }, [refresh]);

  const chartData = useMemo(() => {
    if (!snap) return [];
    return snap.series.map((s) => ({
      ts: new Date(s.timestamp).getTime(),
      rssMb: s.rssKb / 1024,
    }));
  }, [snap]);

  const previewRestart = async () => {
    try {
      const result = await api.post<RestartExtHostPreview>(
        "/memory/preview-restart-ext-host",
        {},
      );
      setPreview(result);
    } catch (err) {
      setError(describe(err));
    }
  };

  const commit = async () => {
    if (!preview) return;
    setCommitting(true);
    try {
      await api.post("/memory/restart-ext-host", { token: preview.token });
      setPreview(null);
      // Give code-server a moment to respawn, then refresh.
      setTimeout(() => void refresh(), 2000);
    } catch (err) {
      setError(describe(err));
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Card
      title="Memory + OOM Timeline"
      description="Extension host RSS (1h @ 15s) and recent OOM events from journalctl."
      action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={previewRestart}
            disabled={!snap || snap.current.extHostPid === null}
          >
            Restart ext host…
          </Button>
        </div>
      }
    >
      {error && (
        <div className="mb-3 rounded-md border border-red-800 bg-red-950/30 p-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && !snap ? (
        <Spinner label="Sampling memory…" />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <Stat
              label="Ext host PID"
              value={snap?.current.extHostPid?.toString() ?? "—"}
            />
            <Stat
              label="Current RSS"
              value={snap ? formatKb(snap.current.rssKb) : "—"}
            />
            <Stat label="OOMs (24h)" value={ooms.length.toString()} />
          </div>

          {chartData.length === 0 ? (
            <EmptyState
              title="No samples yet"
              description="The agent samples every 15s. Give it a minute or check that ext host is running."
            />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="ts"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(v: number) => formatTime(new Date(v).toISOString())}
                    stroke="#52525b"
                    fontSize={11}
                  />
                  <YAxis
                    stroke="#52525b"
                    fontSize={11}
                    tickFormatter={(v: number) => `${v.toFixed(0)} MB`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#18181b",
                      border: "1px solid #3f3f46",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                    labelFormatter={(v: number) => formatTime(new Date(v).toISOString())}
                    formatter={(v: number) => [`${v.toFixed(1)} MB`, "RSS"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="rssMb"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  {ooms.map((e, i) => (
                    <ReferenceLine
                      key={`${e.pid}-${i}`}
                      x={new Date(e.timestamp).getTime()}
                      stroke="#ef4444"
                      strokeDasharray="2 2"
                      label={{
                        value: "OOM",
                        fill: "#ef4444",
                        fontSize: 10,
                        position: "top",
                      }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      <Dialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        title="Confirm: restart extension host"
        description="code-server will respawn the extension host. Your open file tabs and terminals remain — only extensions reload."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPreview(null)} disabled={committing}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={commit} disabled={committing}>
              {committing ? "Restarting…" : "Restart now"}
            </Button>
          </>
        }
      >
        {preview && (
          <div className="space-y-2 text-sm">
            <div>
              Ext host PID{" "}
              <span className="font-mono text-zinc-300">{preview.plan.extHostPid}</span>
            </div>
            <div>
              Current RSS{" "}
              <span className="font-mono text-zinc-300">{formatKb(preview.plan.rssKb)}</span>
            </div>
          </div>
        )}
      </Dialog>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-100">{value}</div>
    </div>
  );
}

function describe(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return err instanceof Error ? err.message : String(err);
}
