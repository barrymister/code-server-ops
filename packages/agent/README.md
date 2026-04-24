# code-server-ops-agent

Fastify sidecar agent for [code-server-ops](https://github.com/barrymister/code-server-ops). Runs alongside a self-hosted code-server container (shared PID namespace) and exposes a REST API over its terminals, extensions, AI processes, and extension-host memory.

![Memory + OOM Timeline](https://raw.githubusercontent.com/barrymister/code-server-ops/main/docs/screenshots/04-memory.png)

## Endpoints

**Read (basic-auth gated):**

| Method | Path | Returns |
|---|---|---|
| GET | `/terminals` | Shell-integration bash processes with age, RSS, ptyHost parent, cwd, attached/orphan status. |
| GET | `/extensions` | Folder-on-disk vs `extensions.json` — orphan badges + multi-version peers. |
| GET | `/ai-processes` | Claude Code / Copilot / Continue / Cline / Codex processes + conversation IDs. |
| GET | `/memory` | Current ext-host RSS + 1h ring buffer @ 15s samples. |
| GET | `/oom-events` | Parsed OOM-kill lines from `journalctl` (configurable window). |

**Mutate (Preview→Confirm token pattern):**

| Method | Path | Action |
|---|---|---|
| POST | `/terminals/preview-kill` → `/terminals/kill` | SIGKILL by PID list or bulk (orphans older than N seconds). |
| POST | `/extensions/preview-gc` → `/extensions/gc` | `rm -rf` orphan extension folders (defaults to all orphans). |
| POST | `/ai-processes/preview-kill` → `/ai-processes/kill` | SIGTERM AI-process duplicates by PID list or `duplicatesOnly`. |
| POST | `/memory/preview-restart-ext-host` → `/memory/restart-ext-host` | SIGTERM the extension host; code-server respawns it. |

Every mutation requires a preview first. The server returns a 32-char hex token (60s TTL, single-use) and re-validates the plan at both preview and commit time — a stale tab cannot drive-by a destructive call.

**Operator:**

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | `{ status: "ok" }` — unauthenticated. |
| GET | `/metrics` | Prometheus text format — `csops_terminals_orphan_total`, `csops_extensions_orphan_bytes`, `csops_ai_processes_total{extension}`, `csops_oom_events_total`, `csops_ext_host_rss_bytes`. Unauthenticated (protect via network ACL). |

## Install (sidecar)

```yaml
services:
  code-server-ops-agent:
    image: ghcr.io/barrymister/code-server-ops:0.1.0
    pid: "container:code-server"
    network_mode: "service:code-server"
    volumes:
      - /var/log/journal:/var/log/journal:ro
      - code-server-extensions:/home/coder/.local/share/code-server/extensions
    environment:
      CSOPS_PASSWORD: "${CSOPS_PASSWORD}"
```

See [docs/INSTALL.md](https://github.com/barrymister/code-server-ops/blob/main/docs/INSTALL.md) for sidecar + non-root `CAP_SYS_PTRACE` hardening + standalone systemd recipes.

Standalone npm install (no Docker):

```bash
# On the code-server host. The agent reads /proc and /var/log/journal natively.
export CSOPS_PASSWORD=$(openssl rand -hex 32)
npx -y code-server-ops-agent@0.1.0
# or pinned global:
npm install -g code-server-ops-agent
```

## Environment

| Variable | Default | Notes |
|---|---|---|
| `CSOPS_PASSWORD` | *(required)* | Basic-auth password. |
| `CSOPS_PORT` | `4242` | |
| `CSOPS_HOST` | `0.0.0.0` | |
| `CSOPS_EXTENSIONS_DIR` | `/home/coder/.local/share/code-server/extensions` | Scanned for orphan folders. |
| `CSOPS_UI_ROOT` | auto-resolves | If set, serves a Vite SPA at `/`. |
| `CSOPS_PROC_DIR` | `/proc` | Override for dev. |
| `CSOPS_LOG_LEVEL` | `info` | |

## License

MIT. See [LICENSE](https://github.com/barrymister/code-server-ops/blob/main/LICENSE).
