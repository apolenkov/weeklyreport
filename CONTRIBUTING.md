# Contributing to WeeklyReport

## Setup

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres redis
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай' \
  pnpm db:bootstrap:local demo
pnpm dev # web on :3000, api on :3002
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

## Local quality gate

Before committing, run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`,
`pnpm test`, and `pnpm build`. The lint floor is zero warnings.

## Pushing to `gitlab/main`

The canonical remote is `https://gitlab.example.org/acme/weeklyreport.git` (remote `gitlab`).
Before relying on a push, verify the configured remote, authenticated private
read access, the pushed commit, and the remote SHA. A successful local hook does
not prove that GitLab accepted the update or ran CI.

## Common gotchas

- **`pnpm test` runs workspace unit tests, Prisma tests, and the root repository
  cleanliness and operations checks; it does not run database integration
  tests.** For the API's colocated integration tests, start Postgres and run
  `pnpm --filter @customreport/api test:integration`.
- **`pnpm dev` starts both web (3000) + api (3002) in parallel.** Stop the run
  from its owning terminal with `Ctrl-C`. If a port is occupied, inspect the
  exact listener with `lsof -nP -iTCP:3000 -sTCP:LISTEN` or port `3002`, then
  stop only the process you own.
- **Reset the dev DB:** select `demo` or `stress` in the in-app development
  controls. Each action calls `dev.wipeAndReseed` and reloads.
