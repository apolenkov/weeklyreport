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

- pre-commit — `prettier --check`, ESLint and Stylelint on staged files (skipped in CI, for agents (`AGENT_*`) and during merges and rebases);
- commit-msg — commitlint (`commitlint.config.ts`): Conventional Commits (plus `merge:` and
  `Merge branch …`), scope from the list; CI does not repeat it;
- pre-push — `pnpm check:push`: `format:check`, `lint`, `typecheck`, `test`, `spec:check`,
  `audit:dependencies` and `scan:secrets`. Skipped when `CI` is set or with
  `WR_SKIP_PUSH_CHECKS=1`.

Hooks live in the common git directory and work in every worktree without a separate install.

## Local quality gate

Before committing, run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`,
`pnpm test`, `pnpm build`, and `pnpm spec:check`. The lint floor is zero warnings.

## Pushing and CI

The canonical remote is [apolenkov/weeklyreport](https://github.com/apolenkov/weeklyreport)
(`origin`). Work on a branch and open a pull request to `main`.

The [CI workflow](.github/workflows/ci.yml) runs three independent jobs on pull
requests and pushes to `main`. Checks runs format, lint, type checking, and
tests. Coverage runs the API and web suites with the configured thresholds.
Supply chain validates OpenSpec, scans for secrets, and audits dependencies.
Merge after all CI jobs pass. Use the
[deployment guide](docs/gitlab-ci.md) for a GitLab-hosted installation.

Use the [security policy](SECURITY.md) for private vulnerability reports.

## Common gotchas

- **`pnpm test` runs workspace unit tests, Prisma tests, and the root repository
  cleanliness and operations checks; it does not run database integration
  tests.** To run the API integration suite, provision the test services and
  prepare the disposable target as described in the [test setup](docs/onboarding.md).
  From the repository root, run `pnpm test:integration`. The suite fails if
  Mailpit is unavailable.
- **`pnpm dev` starts both web (3000) + api (3002) in parallel.** Stop the run
  from its owning terminal with `Ctrl-C`. If a port is occupied, inspect the
  exact listener with `lsof -nP -iTCP:3000 -sTCP:LISTEN` or port `3002`, then
  stop only the process you own.
- **Reset the dev DB:** select `minimal`, `demo`, `full`, or `stress` in the in-app development
  controls. Each action calls `dev.wipeAndReseed` and reloads.
