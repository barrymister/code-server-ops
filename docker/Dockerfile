FROM node:20-slim AS build
WORKDIR /build

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY packages/agent/package.json ./packages/agent/
COPY packages/cli/package.json ./packages/cli/

RUN pnpm install --frozen-lockfile=false

COPY packages/agent ./packages/agent
COPY packages/cli ./packages/cli
RUN pnpm turbo run build --filter=code-server-ops-agent

FROM node:20-slim AS runtime

# systemd-journal-remote pulls in the `journalctl` client without the daemon.
# procps for ps/top/etc during debugging.
RUN apt-get update \
    && apt-get install -y --no-install-recommends procps systemd-journal-remote \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /build/packages/agent/dist ./dist
COPY --from=build /build/packages/agent/package.json ./package.json
COPY --from=build /build/packages/agent/node_modules ./node_modules

ENV NODE_ENV=production
ENV CSOPS_HOST=0.0.0.0
ENV CSOPS_PORT=4242
EXPOSE 4242

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.CSOPS_PORT||4242)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
