# Install

Two supported install paths: **sidecar** (recommended) and **standalone agent on the host**.

---

## Sidecar (recommended)

Run the agent in a separate container that shares code-server's PID namespace. Clean lifecycle, no code-server image modification.

### 1. Set a password

In your `.env`:

```bash
CSOPS_PASSWORD=$(openssl rand -base64 32)
```

### 2. Drop the compose snippet

Copy `docker/compose.example.yaml` into your existing code-server compose and reconcile. Minimum viable sidecar:

```yaml
services:
  code-server-ops-agent:
    image: ghcr.io/barrymister/code-server-ops:0.0.1-alpha.1
    pid: "container:code-server"
    volumes:
      - code-server-extensions:/home/coder/.local/share/code-server/extensions:ro
      - /var/log/journal:/var/log/journal:ro
    environment:
      CSOPS_PASSWORD: ${CSOPS_PASSWORD}
    ports:
      - "4242:4242"
```

### 3. Verify

```bash
docker compose up -d code-server-ops-agent
curl -s http://127.0.0.1:4242/health
# → {"status":"ok"}

curl -s -u ops:$CSOPS_PASSWORD http://127.0.0.1:4242/terminals | jq .
```

### 4. Use the CLI

```bash
npx code-server-ops-cli@alpha terminals list --orphan-only
npx code-server-ops-cli@alpha extensions gc        # preview in v0.0.1-alpha.1
npx code-server-ops-cli@alpha memory watch -i 10
```

---

## Privilege model

The agent runs as **root** inside its container by default. This is the simplest path to reading `/proc/<pid>/{cmdline,status,stat,cwd}` for processes the sidecar doesn't own.

### Non-root hardening (optional)

If your security posture requires it, drop privileges and grant only `CAP_SYS_PTRACE`:

```yaml
services:
  code-server-ops-agent:
    # ... as above ...
    user: "1000:1000"
    cap_drop:
      - ALL
    cap_add:
      - SYS_PTRACE
```

`SYS_PTRACE` is the minimum capability that lets a non-root process read foreign `/proc` entries under the default `proc_hidepid` kernel setting. If your kernel has `hidepid=2` set, you additionally need to run the agent under the same gid as code-server (`gid=<code-server-gid>`) and pass the correct `hidepid_gid` mount option.

---

## Kernel log access for `/oom-events`

The `/oom-events` endpoint parses OOM kill events from the systemd journal. The agent container installs the `journalctl` client and expects the host's journal directory mounted read-only:

```yaml
volumes:
  - /var/log/journal:/var/log/journal:ro
```

If your host uses `/run/log/journal/` (volatile, no persistent journal), mount that path instead and expect data only since the last boot.

If no journal is available, the agent falls back to `/var/log/kern.log`. If neither is available, `/oom-events` returns an empty array — the other endpoints continue to work.

---

## Standalone (no Docker)

For running the agent directly on the host next to a systemd code-server:

```bash
npm install -g code-server-ops-agent@alpha

CSOPS_PASSWORD=$(openssl rand -base64 32) \
  code-server-ops-agent
```

Systemd unit template (drop into `/etc/systemd/system/code-server-ops-agent.service`):

```ini
[Unit]
Description=code-server-ops agent
After=network.target code-server.service

[Service]
Type=simple
Environment=CSOPS_PASSWORD=...
Environment=CSOPS_EXTENSIONS_DIR=/home/coder/.local/share/code-server/extensions
ExecStart=/usr/bin/env code-server-ops-agent
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

---

## Upgrading

Pin an explicit version tag. This project is pre-1.0 — expect breaking changes between `alpha` releases.

```bash
docker compose pull code-server-ops-agent
docker compose up -d code-server-ops-agent
```
