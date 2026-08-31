# AGENTS.md

This file provides guidance to Codex when working with code in this repository.

Global language and response-style preferences live in `~/.codex/AGENTS.md`.
Keep this file limited to WeeklyReport-specific context.

## Project

WeeklyReport automates weekly status reports for the CoreDev department.
Leads fill structured report sections independently; the head reviews,
publishes, and exports a unified report. pnpm + Turbo monorepo:

- `apps/web` — Next.js 16 / React 19 frontend (`@customreport/web`)
- `apps/api` — NestJS 11 / tRPC 11 / Prisma 7 backend (`@customreport/api`)
- `packages/report-persistence` — server-only Prisma include, mapper, and
  published-snapshot assembly (`@customreport/report-persistence`)
- `packages/migrator-runtime` — pinned Prisma CLI/dotenv manifest used only to
  build the minimal production migration image
- `packages/shared` — Zod schemas, tRPC contracts (update here before duplicating types)
- `packages/ui` — shadcn/ui + Tailwind 4 tokens
- `prisma` — schema, single init migration, seeds, destructive guard
- `openspec` — durable product and engineering specifications (`specs/`)

## Commands

Use `pnpm` from the repo root (Node 26.8.1 Current, `>=26.0.0 <27.0.0`). Never `npm`/Yarn.

```bash
pnpm dev                # run API and web from source
pnpm dev:watch          # docker compose dev with --watch
pnpm typecheck          # Prisma/scripts tsc + turbo package typechecks
pnpm lint               # ESLint, Stylelint, runtime sync, repository cleanliness
pnpm test               # package unit suites plus root safety tests
pnpm build              # turbo run build
pnpm spec:check         # strict validation of all durable OpenSpec specs
```

- `pnpm lint` runs every configured check and exits non-zero on a failure. Each
  check is runnable alone through its package script.
- Run one unit test: `cd apps/web && pnpm exec vitest run src/path/to/file.test.tsx`
  (same in `apps/api`). Do NOT wrap `vitest` in `rtk`. RTK 0.45.0 preserves
  the non-zero exit code for a no-tests failure but renders the result as
  `PASS (0) FAIL (0)`, which hides the actual Vitest diagnostic.
- If TS errors reference a known Prisma model (e.g. TS2339), run
  `pnpm --filter @customreport/api db:generate` — pnpm ops wipe the `.prisma` client.
- Product tests are colocated under each package. The root `pnpm test` runs the
  unit and repository-safety suites; API database integration tests run with
  `pnpm --filter @customreport/api test:integration` against an explicitly
  guarded disposable database.

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
- Redis connections require explicit `REDIS_DB`. Product/dev environments use
  logical DB 0; E2E uses reserved logical DB 15. Destructive E2E Redis cleanup
  must select DB 15, pass the exact disposable PostgreSQL guard and per-run
  consent, and must never flush DB 0.

## Load-Bearing Invariants

No DB constraint enforces these — code review and CI do. Any change to a write
path must respect them and link the relevant `openspec/specs/` spec.

- **Period dual-state.** A Report carries canonical `periodState` plus its
  companion lifecycle tuple (`status`, `periodStatus`, `archived`, audit flags,
  and applicable timestamps); lifecycle writers must update them atomically.
- **Role-coverage gate.** tRPC procedures must use one of the 6 canonical
  middleware-chain builders (matched by reference identity). Don't hand-roll a chain.

## Conventions

- **`docs/` is curated product documentation only** (index:
  `docs/README.md`). Temporary review data and run artifacts stay outside the
  repository.

- **OpenSpec is the source of truth.** Read `openspec list` + `openspec/specs/`
  before changing query semantics or behavior; non-trivial work starts as a change.
- **UI strings stay English** in `apps/web/src/**/*.tsx` (JSX/toast/aria/placeholder).
  Russian allowed only as DB/seed data, comments, and test fixtures.
  Check changed files: `grep -nE '[а-яА-Я]' <file>` — every hit must be data/comment/test.
- **Quality standard.** Follow `docs/exemplary-code-standard.md` and the
  repository gates. Do not add per-file lint exemptions.
- **Product configuration fails closed.** Required values have no silent default;
  validate with Zod, read through `requireEnv`, and supply them per environment.
- **Comments record current rationale only.** Keep them short and remove
  changelog archaeology. JSDoc is required only for public exports from
  `packages/shared` and `packages/ui`; TypeScript already carries type details.
- **Markers are traceable.** Use `TODO(<ref>): short imperative note`; remove
  stale or unreferenced `TODO`/`FIXME`/`HACK`/`XXX` markers.

## Gates

CI (`.github/workflows/ci.yml`) runs on every push to `main`, on pull requests,
and on manual dispatch. Run the matching local commands before pushing.
