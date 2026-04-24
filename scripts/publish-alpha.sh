#!/usr/bin/env bash
# Publish code-server-ops-{agent,cli,ui} to npm under the `alpha` dist-tag.
#
# Prereq: you must be logged in to npm (`npm whoami` should print your username).
# If it 401s, regenerate a token at https://www.npmjs.com/settings/barrymister/tokens
# and write it to ~/.npmrc as:
#     //registry.npmjs.org/:_authToken=npm_...
#
# Usage:
#   bash scripts/publish-alpha.sh            # publish all three
#   bash scripts/publish-alpha.sh --dry-run  # see what would publish

set -euo pipefail

DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Verifying npm auth"
npm whoami || { echo "ERROR: not logged in. See script header."; exit 1; }

echo "==> Building all three packages"
pnpm turbo run build --filter=code-server-ops-agent --filter=code-server-ops-cli --filter=code-server-ops-ui

for pkg in agent cli ui; do
  echo "==> Publishing code-server-ops-$pkg"
  (cd "packages/$pkg" && npm publish --tag alpha $DRY_RUN)
done

echo "==> Done"
