# AGENTS.md

This file provides guidance to Codex when working with code in this repository.

The global operating baseline (style, communication, working rules) lives in
`~/.codex/AGENTS.md`. Keep this file limited to CustomReport-specific context.

## Project

CustomReport automates weekly status reports for a software department.
Leads fill structured report sections independently; the head reviews,
publishes, and exports a unified report. pnpm + Turbo monorepo:

- `apps/web` — Next.js 16 / React 19 frontend (`@customreport/web`)
- `apps/api` — NestJS 11 / tRPC 11 / Prisma 7 backend (`@customreport/api`)
- `packages/shared` — Zod schemas, tRPC contracts (update here before duplicating types)
- `packages/ui` — shadcn/ui + Tailwind 4 tokens
- `prisma` — schema, single init migration, seeds, destructive guard
- `openspec` — active backlog (`changes/`) + durable specs (`specs/`)

## Commands

Use `pnpm` from the repo root (Node >=26). Never `npm`/Yarn.

```bash
pnpm dev:watch          # docker compose dev with --watch
pnpm typecheck          # turbo run typecheck (depends on prisma generate)
pnpm lint               # scripts/gates/orchestrator/lint-gate.ts — ALL checks run, every failure reported
pnpm test               # turbo run vitest (unit only)
pnpm build              # turbo run build
```

- `pnpm lint` is `scripts/gates/orchestrator/lint-gate.ts`: it runs every configured check (eslint, stylelint,
  3 tsc projects, typecov, SSOT test + sweep, runtime-node, depcruise, knip,
  plus the ratchet and scope-probe suites), prints a
  PASS/FAIL table and exits 1 if any failed. Each is runnable alone
  (`pnpm lint:eslint`, …). `pnpm lint --fail-fast` restores stop-at-first.
- Run one unit test: `cd apps/web && pnpm exec vitest run src/path/to/file.test.tsx`
  (same in `apps/api`). Do NOT wrap `vitest` in `rtk`. RTK 0.45.0 preserves
  the non-zero exit code for a no-tests failure but renders the result as
  `PASS (0) FAIL (0)`, which hides the actual Vitest diagnostic.
- If TS errors reference a known Prisma model (e.g. TS2339), run
  `pnpm --filter @customreport/api db:generate` — pnpm ops wipe the `.prisma` client.
- E2E (Playwright, single-worker shared seed): `pnpm test:e2e:integration`.
  Needs `E2E_DATABASE_URL` distinct from `DATABASE_URL`.

## Runtime

- Web `http://localhost:3000`, API `http://localhost:3002`, Mailpit UI `http://localhost:8025`.
- Dev auth: `AUTH_DEV_MODE=true` + `/auth/dev-login`; refused at boot when `NODE_ENV=production`.
- `NEXT_PUBLIC_DEV_ROLE_SWITCHER=true` shows the dev-only role switcher.
- The docker `web`/`api` containers serve a STALE built image; to live-verify new
  code, run the app from source using `docs/onboarding.md` or `pnpm dev`.

## Database safety

- This file records safety boundaries, not standing permission for destructive
  work or credential lifecycle. Obtain task-specific authority before reset,
  reseed, migration-history rewrite, deletion, or credential operations.
- **The only disposable database candidates are `customreport_e2e` and the
  runtime-lane targets `customreport_e2e_lane_[a-o]_test`.** Destructive database
  work may target only those exact non-production databases.
  Resolve the target from `E2E_DATABASE_URL` (or the command's explicit
  database URL), prove that it is not production, shared, or unknown, and
  require `prisma/guards/_destructive-guard.ts` to accept it before every
  destructive command.
- Set the explicit per-run consent for each authorized operation:
  `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай'`. Do not rely on global
  or blanket disposable-database authorization, and never bypass the guard.
- Prisma 7 quirk: `migrate reset` does NOT auto-seed; run the required seed
  explicitly under the same consent after a successful reset.

## Load-Bearing Invariants

No DB constraint enforces these — code review and CI do. Any change to a write
path must respect them and link the relevant `openspec/specs/` spec.

- **Period dual-state.** A Report carries both the new period state and the legacy
  period tuple; concurrent leads must write both atomically.
- **Role-coverage gate.** tRPC procedures must use one of the 8 canonical
  middleware-chain builders (matched by reference identity). Don't hand-roll a chain.

## Conventions

- **`docs/` is curated documentation only** (index: `docs/README.md`). Session
  artifacts — handoffs, review data dumps, run plans, pipeline scripts — go to
  `~/work/customreport-archive/` (outside git; keep its `INDEX.md` current).
  The pre-commit guard blocks `*.data.json`, `HANDOFF-*`, `*.js.txt` under `docs/`.
  Harness/skill outputs must default to the archive, never to `docs/`.

- **OpenSpec is the source of truth.** Read `openspec list` + `openspec/specs/`
  before changing query semantics or behavior; non-trivial work starts as a change.
- **Deferred features leave traces.** UI → `ComingSoonBadge` on an inert control;
  backend → `throw new Error('Not implemented — see TODO(<ref>)')`. Never a hidden flag.
- **UI strings stay English** in `apps/web/src/**/*.tsx` (JSX/toast/aria/placeholder).
  Russian allowed only as DB/seed data, comments, and test fixtures.
  Check changed files: `grep -nE '[а-яА-Я]' <file>` — every hit must be data/comment/test.
- **Quality standard.** Follow `docs/exemplary-code-standard.md`; use
  `.codex/skills/exemplary-audit/SKILL.md` for a measured audit and the relevant
  `scripts/gates/` checks for enforcement. Do not add per-file lint exemptions.
- **Product configuration fails closed.** Required values have no silent default;
  validate with Zod, read through `requireEnv`, and supply them per environment.
- **Comments record current rationale only.** Keep them short and remove
  changelog archaeology. JSDoc is required only for public exports from
  `packages/shared` and `packages/ui`; TypeScript already carries type details.
- **Markers are traceable.** Use `TODO(<ref>): short imperative note`; remove
  stale or unreferenced `TODO`/`FIXME`/`HACK`/`XXX` markers.

## Gates

`.husky/pre-commit` runs lint-staged (eslint + stylelint + prettier on staged files).
`.husky/pre-push` runs typecheck, the full lint gate, format check, catalog drift,
mutation-consumer audit, and the full unit suite (skip with `SKIP_PREPUSH=1`).
CI (`.github/workflows/ci.yml`) runs on every push to `main`, on pull requests,
and on manual dispatch. Local hooks are the first gate, not the only one.
Pushing a new app route trips the catalog-drift gate: add a scenario to
`e2e/catalog/<role>.yaml` (or `EXCLUDED_ROUTES`) and re-run `pnpm catalog:check`.
