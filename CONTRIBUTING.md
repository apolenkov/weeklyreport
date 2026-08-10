# Contributing to CustomReport

## Setup

```bash
docker compose up -d postgres redis mailpit
pnpm install                         # auto-installs husky hooks via `prepare`
pnpm exec prisma migrate deploy
pnpm exec tsx prisma/seed.ts          # full local development dataset
pnpm dev                             # web on :3000, api on :3002
```

## Commit conventions

We enforce [Conventional Commits](https://www.conventionalcommits.org/) via
`commitlint` (see `commitlint.config.cjs`). Every commit subject must match:

```
<type>(<scope>): <summary>
```

Allowed types: `feat | fix | chore | docs | refactor | test | perf | ci | build | style | revert`.

Subject ≤ 100 chars. Body is free-form (multi-line line length unrestricted).

## Local quality gate (husky hooks)

| Hook         | Runs                                                                                                                        | Bypass                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `pre-commit` | `lint-staged`: strict ESLint and Prettier for staged TS/JS, Stylelint and Prettier for CSS, Prettier for JSON/Markdown/YAML | `git commit --no-verify`  |
| `commit-msg` | `commitlint` on the subject line                                                                                            | `git commit --no-verify`  |
| `pre-push`   | typecheck, full lint gate, format check, catalog drift, mutation-consumer audit, and the full unit suite                    | `SKIP_PREPUSH=1 git push` |

The lint floor is zero warnings. Use hook bypasses only for an explicit recovery
or diagnostic workflow; a bypass is not completion evidence.

## Pushing to `origin/main`

The canonical remote is `https://github.com/apolenkov/weeklyreport.git`.
Before relying on a push, verify the configured remote, authenticated private
read access, the pushed commit, and the remote SHA. A successful local hook does
not prove that GitHub accepted the update or ran CI.

## Mutation Consumer Audit

CI runs `pnpm uat:audit` on every push/PR. It catches the "tRPC mutation
exists, fires a toast, but the row is never persisted / never displayed
anywhere" pattern (see `.planning/INTERACTION-INVENTORY-2026-05-05.md`).

If you intentionally add a cron-triggered or backend-only mutation, add
it to `apps/web/uat-suite/mutation-audit.allowlist.json` with a one-line
justification:

```bash
pnpm uat:audit:update    # adds the new black-hole entry with a TODO reason
# then edit the file to replace TODO with the real justification
```

## Common gotchas

- **`pnpm test` requires a running Postgres** — for unit tests it's only
  needed by integration specs (excluded from `pnpm test`); for `pnpm test:integration`
  bring up `docker compose up -d postgres` first.
- **`pnpm dev` starts both web (3000) + api (3002) in parallel** — if a
  port collides, kill both: `pkill -f 'turbo run dev'`.
- **Prisma migrations on a fresh dev DB:** run
  `pnpm exec prisma migrate deploy`, then `pnpm exec tsx prisma/seed.ts`.
- **Deterministic seed profiles:** use `pnpm db:seed:profile <profile>` with
  `minimal`, `demo`, `full`, or `stress` only against a verified disposable
  database.
- **Reset the dev DB:** the in-app DEV switcher offers `minimal`, `demo`, `full`,
  and `stress` wipe-and-reseed actions. Select the intended profile; each action
  calls `dev.wipeAndReseed` and reloads.
