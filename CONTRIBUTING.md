# Contributing to WeeklyReport

## Setup

```bash
pnpm install
cp .env.example .env
pnpm deps:up # Postgres, Redis, Mailpit, Gotenberg in the wr-dev namespace
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай' \
  pnpm db:bootstrap:local demo
pnpm dev # web on :3000, api on :3002
```

OpenSpec agent skills and `/opsx` commands are generated, not tracked. After
cloning, recreate them (init also drops a `.gitkeep` the cleanliness gate
forbids):

```bash
pnpm exec openspec init --tools claude,agents && rm openspec/changes/archive/.gitkeep
```

`db:bootstrap:local` is the single setup entrypoint: it verifies the exact
disposable database, applies migrations, and seeds the selected profile. See
[`docs/onboarding.md`](./docs/onboarding.md) for the guard contract and the
`stress` profile.

## Commit conventions

Use a concise commit subject in the form:

```
<type>(<scope>): <summary>
```

Recommended types: `feat | fix | chore | docs | refactor | test | perf | ci | build | style`.

Subject ≤ 100 chars. Body is free-form (multi-line line length unrestricted).

`pnpm install` installs lefthook git hooks (the `prepare` script, `lefthook.yml`):

- pre-commit — `prettier --check`, ESLint and Stylelint on staged files (skipped in CI, for agents (`AGENT_*`) and during merges);
- commit-msg — commitlint (`commitlint.config.ts`): Conventional Commits (plus `merge:` and
  GitLab `Merge branch …`), scope from the list;
- pre-push — light: `format:check`, `typecheck`, `spec:check`; full lint and tests run in the CI
  `quality` job. Skipped when `CI` or any `AGENT_*` variable is set.

Hooks live in the common git directory and work in every worktree without a separate install.

In merge request pipelines the `quality` job runs commitlint over every MR commit.

## Local quality gate

Before committing, run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`,
`pnpm test`, `pnpm build`, and `pnpm spec:check`. The lint floor is zero warnings.

## Pushing to `gitlab/main`

The canonical remote is `https://gitlab.example.org/acme/weeklyreport.git` (remote `gitlab`).
Before relying on a push, verify the configured remote, authenticated private
read access, the pushed commit, and the remote SHA. A successful local push command does
not prove that GitLab accepted the update or ran CI.

## Common gotchas

- **`pnpm test` runs workspace unit tests, Prisma tests, and the root repository
  cleanliness and operations checks; it does not run database integration
  tests.** For the API's colocated integration tests, start Postgres and run
  `pnpm --filter @weeklyreport/api test:integration`.
- **`pnpm dev` starts both web (3000) + api (3002) in parallel.** Stop the run
  from its owning terminal with `Ctrl-C`. If a port is occupied, inspect the
  exact listener with `lsof -nP -iTCP:3000 -sTCP:LISTEN` or port `3002`, then
  stop only the process you own.
- **Reset the dev DB:** select `minimal`, `demo`, `full`, or `stress` in the in-app development
  controls. Each action calls `dev.wipeAndReseed` and reloads.
