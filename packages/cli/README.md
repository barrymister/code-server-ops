# code-server-ops-cli

Cron-friendly CLI (`csops`) for [code-server-ops](https://github.com/barrymister/code-server-ops). Wraps the `code-server-ops-agent` REST API.

![Terminal Inspector](https://raw.githubusercontent.com/barrymister/code-server-ops/main/docs/screenshots/01-terminals.png)

## Install

```bash
npm install -g code-server-ops-cli
```

## Configure

```bash
export CSOPS_URL=http://code-server-host:4242
export CSOPS_PASSWORD=your-agent-password
```

## Usage

```bash
# Inspect
csops terminals list --orphan-only --older-than 24h
csops extensions list --orphan-only
csops memory show

# Mutate (all commands show a preview; pass --yes to commit)
csops terminals kill 3355247 --yes
csops terminals kill-orphans --older-than 24h --yes
csops extensions gc --yes
csops memory restart-ext-host --yes

# Cron-friendly
csops terminals list --orphan-only --older-than 7d --json | jq '.[].pid' | \
  xargs -I {} csops terminals kill {} --yes --json
```

## Commands

| Command | Description |
|---|---|
| `terminals list [--orphan-only] [--older-than <dur>] [--json]` | List shell-integration bashes. |
| `terminals kill <pid> [--yes] [--json]` | Preview → SIGKILL a single PID. |
| `terminals kill-orphans [--older-than <dur>] [--yes] [--json]` | Bulk kill orphans. |
| `extensions list [--orphan-only] [--json]` | List extension folders vs registry. |
| `extensions gc [--yes] [--json]` | Preview → `rm -rf` all orphan folders. |
| `memory show [--json]` | Print current ext-host RSS. |
| `memory watch [-i <seconds>]` | Poll and print on interval. |
| `memory restart-ext-host [--yes] [--json]` | Preview → SIGTERM ext host (code-server respawns it). |

Every destructive command runs a server-side Preview first and requires the `--yes` flag to commit with the returned confirmation token.

## License

MIT. See [LICENSE](https://github.com/barrymister/code-server-ops/blob/main/LICENSE).
