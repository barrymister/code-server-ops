# code-server-ops

Admin dashboard + agent for self-hosted [code-server](https://github.com/coder/code-server). Fills the "won't fix" gap upstream left.

> **Status:** Pre-alpha. `v0.0.1-alpha.1` ships the agent + CLI. UI package + kill/GC mutation flows land in `v0.1.0`.

## Why this exists

If you self-host code-server for a single user (not a team), you hit operational failure modes upstream refuses to fix:

- **Orphan bash terminals accumulate across tab closes.** Closed as "use tmux/screen": [coder/code-server#6291](https://github.com/coder/code-server/issues/6291), [#7228](https://github.com/coder/code-server/issues/7228).
- **Extension folders are never deleted.** Uninstall updates `extensions.json` but leaves the directory. Auto-update registers new versions without removing old ones. Closed `not_planned`: [vscode#213844](https://github.com/microsoft/vscode/issues/213844), [vscode#78107](https://github.com/microsoft/vscode/issues/78107).
- **Extension host V8 heap runs out with AI-assistant extensions.** Still open and chronic: [vscode#294050](https://github.com/microsoft/vscode/issues/294050), [vscode#309016](https://github.com/microsoft/vscode/issues/309016), [vscode#266716](https://github.com/microsoft/vscode/issues/266716).

Coder Enterprise addresses some of this — for team workspaces managed via Terraform + k8s. For single-tenant self-hosters there is no admin panel. That is the gap this project fills.

## What's in the box (v0.0.1-alpha.1)

| Package | What it does |
|---|---|
| `code-server-ops-agent` | Fastify service, 6 read-only endpoints (`/terminals`, `/extensions`, `/ai-processes`, `/memory`, `/oom-events`, `/metrics`). Runs as a sidecar next to code-server. |
| `code-server-ops-cli` | `csops` — commander-based terminal client. `csops terminals list`, `csops extensions list`, `csops memory watch`. Cron-friendly with `--json`. |

Coming in `v0.1.0` (session 97):

- UI package: Vite + React 19 + Tailwind v4 + shadcn. Dark-mode dashboards with Preview-before-commit kill/GC flows.
- Docker image on `ghcr.io/barrymister/code-server-ops`.
- Reference deployment: [engine.barrymister.dev/infrastructure/code-server](https://engine.barrymister.dev/infrastructure/code-server).

## Install (sidecar)

```yaml
services:
  code-server-ops-agent:
    image: ghcr.io/barrymister/code-server-ops:0.0.1-alpha.1   # available session 97
    pid: "container:code-server"
    network_mode: "service:code-server"
    volumes:
      - /var/log/journal:/var/log/journal:ro
      - code-server-extensions:/home/coder/.local/share/code-server/extensions:ro
    environment:
      - CSOPS_PASSWORD=${CSOPS_PASSWORD}
```

See [docs/INSTALL.md](./docs/INSTALL.md) for the full sidecar recipe and the `CAP_SYS_PTRACE` non-root hardening path.

## Architecture

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the sidecar topology diagram and component responsibilities.

## License

MIT. See [LICENSE](./LICENSE).
