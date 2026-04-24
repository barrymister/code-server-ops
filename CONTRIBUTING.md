# Contributing

Thanks for your interest. A few ground rules.

## Scope

This project fills the admin-panel gap for single-tenant self-hosted code-server. If you need multi-tenant workspace orchestration, [Coder Enterprise](https://coder.com) is the right tool.

## Invariants

- **Preview before commit.** Every destructive action (kill, gc, restart) shows what will happen before it runs. No silent mutations.
- **Zero-config defaults.** The agent works on port 4242 with a password env var. Nothing else should be required to get value.
- **No graphs for graph's sake.** Every chart answers a specific ops question. If you can't state the question, cut the chart.

## PR workflow

1. Fork, branch from `main`.
2. `pnpm install && pnpm turbo lint typecheck test` locally — CI runs the same.
3. Commit style: `feat(agent):`, `fix(cli):`, `docs:`, `chore:`, `refactor:`.
4. Open PR against `main`. CI must be green before review.

## License

By contributing you agree your changes ship under MIT.
