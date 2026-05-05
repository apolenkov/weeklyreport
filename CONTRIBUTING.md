# Contributing to CustomReport

## Setup

```bash
docker compose up -d postgres redis mailpit
pnpm install                         # auto-installs husky hooks via `prepare`
pnpm exec prisma migrate deploy
pnpm db:seed:advanced
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

| Hook | Runs | Bypass |
|---|---|---|
| `pre-commit` | `lint-staged` → `eslint --fix --max-warnings=0` on staged TS/JS, `prettier --write` on staged JSON/MD/YAML | `git commit --no-verify` |
| `commit-msg` | `commitlint` on subject line | `git commit --no-verify` |
| `pre-push` | `pnpm test` (full unit suite) | `SKIP_PREPUSH=1 git push` (or set `CI=true`) |

If you see `lint-staged` failing on a file you didn't touch, it's because
the warning floor is currently above zero (REQ Q-06 will close this). Fix
the warning or `--no-verify` is OK as a temporary measure.

## Pushing to `origin/main`

The corporate GitHub (`ghe.example.org`) requires VPN. If a `git push`
fails with a DNS error or `could not resolve host`, the cause is almost
always:

- **VPN not connected** — connect, retry.
- **Proxy env vars routing through an unreachable proxy** — clear them.

The recurring workaround is:

```bash
https_proxy="" http_proxy="" git push origin main
```

A helper script handles the detection + workaround automatically:

```bash
scripts/push-guard.sh           # detects DNS state, retries with proxy unset
scripts/push-guard.sh --check-only   # exit 0 if pushable, 1 otherwise
```

Recommended alias in `~/.zshrc`:

```bash
alias gpush='scripts/push-guard.sh'
```

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
- **Prisma migrations on a fresh dev DB:** `pnpm exec prisma migrate deploy`
  + `pnpm db:seed:advanced` (or `pnpm db:seed:simple` for a minimal seed).
- **Reset the dev DB:** the in-app DEV switcher has a "Wipe + Reseed
  (advanced)" menu item — it calls `dev.wipeAndReseed` and reloads.
