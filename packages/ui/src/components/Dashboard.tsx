import { useState } from "react";
import { hasPassword, clearPassword } from "../lib/api.js";
import { LoginGate } from "./LoginGate.js";
import { Button } from "./primitives.js";
import { TerminalsPanel } from "../dashboards/Terminals.js";
import { ExtensionsPanel } from "../dashboards/Extensions.js";
import { AiProcessesPanel } from "../dashboards/AiProcesses.js";
import { MemoryTimelinePanel } from "../dashboards/MemoryTimeline.js";

type Tab = "terminals" | "extensions" | "ai" | "memory";

interface DashboardProps {
  title?: string;
  subtitle?: string;
  /** Skip the login gate — useful when embedded in a host app that handles auth. */
  skipAuth?: boolean;
}

export function Dashboard({
  title = "code-server-ops",
  subtitle = "Admin dashboard for self-hosted code-server",
  skipAuth = false,
}: DashboardProps) {
  const [authed, setAuthed] = useState<boolean>(skipAuth || hasPassword());
  const [tab, setTab] = useState<Tab>("terminals");

  if (!authed) {
    return <LoginGate onAuthenticated={() => setAuthed(true)} />;
  }

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "terminals", label: "Terminals" },
    { key: "extensions", label: "Extensions" },
    { key: "ai", label: "AI Processes" },
    { key: "memory", label: "Memory + OOM" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-base font-semibold">{title}</h1>
            <p className="text-xs text-zinc-500">{subtitle}</p>
          </div>
          {!skipAuth && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                clearPassword();
                setAuthed(false);
              }}
            >
              Sign out
            </Button>
          )}
        </div>
      </header>

      <nav className="border-b border-zinc-800 bg-zinc-900/20">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 py-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={
                tab === t.key
                  ? "rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-50"
                  : "rounded-md px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl space-y-4 p-4">
        {tab === "terminals" && <TerminalsPanel />}
        {tab === "extensions" && <ExtensionsPanel />}
        {tab === "ai" && <AiProcessesPanel />}
        {tab === "memory" && <MemoryTimelinePanel />}
      </main>
    </div>
  );
}
