# Architecture

## Topology

```
┌────────────────────────────────────────────────────────┐
│  host kernel                                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │  PID namespace (shared by the two containers)    │  │
│  │                                                  │  │
│  │  ┌──────────────────┐   ┌───────────────────┐    │  │
│  │  │ code-server      │   │ csops-agent       │    │  │
│  │  │ ──────────────── │   │ ───────────────── │    │  │
│  │  │ ptyHost          │   │ Fastify :4242     │    │  │
│  │  │  ├─ bash (1..n)  │   │  ├─ /terminals    │◀───┼──┐
│  │  │  └─ bash (orph.) │   │  ├─ /extensions   │    │  │
│  │  │ extensionHost    │   │  ├─ /ai-processes │    │  │
│  │  │  ├─ claude-code  │   │  ├─ /memory       │    │  │
│  │  │  ├─ codex        │   │  ├─ /oom-events   │    │  │
│  │  │  └─ continue.…   │   │  └─ /metrics      │    │  │
│  │  └──────────────────┘   └───────────────────┘    │  │
│  │              ▲                     ▲             │  │
│  └──────────────┼─────────────────────┼─────────────┘  │
│             /proc reads          journalctl reads      │
│           (shared PID ns)       (/var/log/journal ro)  │
└────────────────────────────────────────────────────────┘
                                        ▲
                                        │ basic-auth
                                ┌───────┴────────┐
                                │ csops-cli (csv / json / watch)  │
                                │ csops-ui  (session 96)          │
                                └────────────────────────────────┘
```

## Component responsibilities

### `code-server-ops-agent`

Fastify service. Read-only in `v0.0.1-alpha.1`. Six JSON endpoints plus `/health` and `/metrics`:

- **`/terminals`** — enumerates `/proc/*`, filters for `shellIntegration-bash`, cross-refs parent PID against the ptyHost PID to classify attached vs orphan.
- **`/extensions`** — diffs `/home/coder/.local/share/code-server/extensions/*` folders against `extensions.json` registered entries. Reports orphan folders and multi-version peers.
- **`/ai-processes`** — classifies processes by cmdline marker: `claude-code`, `codex`, `copilot-language-server`, `continue.continue`, `cline`.
- **`/memory`** — snapshot of extension host RSS + ring buffer of samples at 15s resolution, up to 1h retained.
- **`/oom-events`** — parses `journalctl -k` for `Out of memory: Killed process <pid> (<comm>)` lines, falls back to `/var/log/kern.log`.
- **`/metrics`** — Prometheus text format. Default Node metrics + custom gauges for orphan counts, extension host RSS, OOM event counter.

All mutation endpoints (kill, gc, restart-ext-host) land in `v0.1.0` (session 96), behind a Preview-before-commit contract.

### `code-server-ops-cli`

commander-based terminal client. Shares the basic-auth scheme with the UI. `--json` flag on every command for cron-friendly output. In `v0.0.1-alpha.1` the `kill`/`gc` commands are read-only previews — they print what would be removed.

### `code-server-ops-ui` (session 96)

Vite + React 19 + Tailwind v4 + shadcn. Consumes the agent REST API and ships as both:

1. A standalone Vite app (`index.html`) served by the Docker image.
2. A React component library published to npm so growth-engine can embed `<CodeServerOpsDashboard />` at `/infrastructure/code-server`.

## Non-goals

- **Multi-tenant workspace orchestration.** That is [Coder Enterprise](https://coder.com)'s problem.
- **Replacing code-server.** This is a read-and-act sidecar, not a fork.
- **Running on non-Linux hosts.** The agent boots on Windows and macOS (for development) but returns empty datasets — `/proc` and `journalctl` are Linux-specific.

## Tech choice rationale

| Pick | Why |
|---|---|
| pnpm + turborepo | Three packages with shared tsconfig and interdependent builds. `pnpm` avoids node_modules bloat; `turbo` caches per-package builds. Standard monorepo pattern for 2026. |
| Fastify (not Express) | Native TypeScript types, 2-3x lower overhead, built-in schema validation. Express is feature-stagnant. |
| `tsup` | tsc would work but tsup emits CJS + ESM + d.ts in one pass with zero config. Matches the existing `ai-model-selector` build pipeline for portfolio consistency. |
| Prometheus `/metrics` | Self-hosters already run node_exporter and scrape their stacks. Exposing `csops_*` gauges is the smallest possible integration surface. |
| Sidecar, not in-container | Agent and code-server have different upgrade cadences. Restarting the agent should not touch code-server. PID namespace sharing gives the agent the `/proc` visibility it needs without modifying the code-server image. |
