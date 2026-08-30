# Contributing to WeeklyReport

## Setup

```bash
docker compose up -d postgres redis
pnpm install
pnpm exec prisma migrate deploy
pnpm db:seed:profile demo             # current local product dataset
pnpm dev                             # web on :3000, api on :3002
```

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

## Pushing to `origin/main`

The canonical remote is `https://github.com/apolenkov/weeklyreport.git`.
Before relying on a push, verify the configured remote, authenticated private
read access, the pushed commit, and the remote SHA. A successful local hook does
not prove that GitHub accepted the update or ran CI.

## Common gotchas

- **`pnpm test` runs workspace unit tests, Prisma tests, and the root repository
  cleanliness and operations checks; it does not run database integration
  tests.** For the API's colocated integration tests, start Postgres and run
  `pnpm --filter @customreport/api test:integration`.
- **`pnpm dev` starts both web (3000) + api (3002) in parallel** — if a
  port collides, kill both: `pkill -f 'turbo run dev'`.
- **Prisma migrations on a fresh dev DB:** run
  `pnpm exec prisma migrate deploy`, then `pnpm db:seed:profile demo`.
- **Deterministic seed profiles:** use `pnpm db:seed:profile demo` for the
  current product dataset or `pnpm db:seed:profile stress` for volume checks,
  only against a verified disposable database.
- **Reset the dev DB:** select `demo` or `stress` in the in-app development
  controls. Each action calls `dev.wipeAndReseed` and reloads.
