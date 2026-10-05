# AGENTS.md

This file provides guidance to coding agents working in this repository.

This file is self-contained for repository work. Keep it limited to
WeeklyReport-specific context.

## Autonomy in the local MVP

- Treat this checkout as an actively developed MVP, not a production release.
  Within the requested task, proceed with local implementation, diagnostics,
  tests, browser checks, and recoverable changes to identified synthetic test
  records without asking for each step. This includes creating/editing records
  and exercising submit, review, and reopen flows in a verified local test
  environment. `localhost` alone does not prove that its backend is disposable.
- **Standing local synthetic-database authority (owner decision 2026-09-23).**
  The local MVP databases named under Database safety contain disposable
  synthetic data. For work within this repository, the owner grants standing
  permission for any database operation the task needs against those exact,
  guard-approved targets: read/write queries; create, update, and delete any
  synthetic records; schema and migration changes, including migration-history
  repair; and full reset, truncate, wipe, drop/recreate, and reseed. Do not ask
  for confirmation per run, command, table, or record. Before destructive
  operations, still verify the exact target, use the repository guard and its
  required consent token, and coordinate concurrent sessions. This authority
  does not authorize creating unprovisioned lane databases or touching any
  production, shared, or unknown target. It also grants authority to clean up
  Redis DB 15, restart local repository processes, recreate repository-scoped
  local Docker resources, and remove generated runtime/build/cache state when
  needed for the task.
- Preserve the task boundary: an audit does not authorize product fixes, and
  explicit read-only instructions override the test-record permission above.
  Do not expand local permission to production, shared/unknown data, credentials,
  paid actions, external messages, or publication. Database safety below still applies.
- Inspect the actual handler before activating a UI control whose side effects
  are unclear; use known fixtures and record the pre-state before lifecycle
  tests; never infer reversibility from a button label. If a test unexpectedly
  changes state, disclose it once, recover when the recovery is known and
  authorized, otherwise isolate that record and continue.

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
- `deploy/helm/weeklyreport` — Kubernetes Helm chart (`docs/kubernetes.md`)
- `prisma` — schema, canonical init plus additive migrations
  (`prisma/migrations`; see Migration policy below), seeds, destructive guard
- `openspec` — durable product and engineering specifications (`specs/`)

## Commands

Use `pnpm` from the repo root (Node 26.10.0 Current, `>=26.0.0 <27.0.0`). Never `npm`/Yarn.

```bash
pnpm dev                # run API and web from source
pnpm deps:up            # local PostgreSQL/Redis/Mailpit/Gotenberg in Kubernetes namespace wr-dev
pnpm deps:down          # stop them; data volumes survive
pnpm typecheck          # Prisma/scripts tsc + turbo package typechecks
pnpm lint               # ESLint, Stylelint, runtime sync, repository cleanliness
pnpm format:check       # Prettier check without rewriting files
pnpm test               # package unit suites plus root safety tests
pnpm build              # turbo run build
pnpm spec:check         # strict validation of all durable OpenSpec specs
pnpm test:e2e           # agent-browser lead-form regression (running app on customreport_e2e, REDIS_DB=15; resets data)
```

- `pnpm lint` runs its checks sequentially and stops at the first failure. Each
  check is runnable alone through its package script.
- Run one unit test: `cd apps/web && pnpm exec vitest run src/path/to/file.test.tsx`
  (same in `apps/api`).
- If the generated Prisma client is missing or out of sync with the schema, run
  `pnpm --filter @customreport/api db:generate` before retrying the affected check.
- Product tests are colocated under each package. The root `pnpm test` runs the
  unit and repository-safety suites; API database integration tests run with
  `pnpm --filter @customreport/api test:integration` against an explicitly
  guarded disposable database.

## Runtime

- Web `http://localhost:3000`, API `http://localhost:3002`, Mailpit UI `http://localhost:8025`.
- Local dependencies (PostgreSQL pgvector, Redis, Mailpit, Gotenberg) run in the
  OrbStack Kubernetes namespace `wr-dev` from `deploy/local-dev/`: `pnpm deps:up`
  before `pnpm dev`, `pnpm deps:down` after (data volumes survive; wipe with
  `kubectl delete namespace wr-dev`). Services appear on localhost at 5432, 6379,
  1025/8025 and 3010, so those ports must be free. There is no Docker Compose
  path in the repository.
- Dev auth: `AUTH_DEV_MODE=true` + `/auth/dev-login`; refused at boot when `NODE_ENV=production`.
- `NEXT_PUBLIC_DEV_ROLE_SWITCHER=true` shows the dev-only role switcher.
- When the owner asks to try the product, start it from source (`pnpm dev`),
  offer a reset to the minimal seed through the guarded flow, report the URLs
  and dev roles, diagnose restarts or hangs from logs, and stop the processes
  at session end.
- Verify that the running app includes the changed sources before browser
  acceptance. An existing Docker image may predate the change; use the source
  workflow in `docs/onboarding.md` or `pnpm dev` when appropriate.
- For browser/E2E work that requires Redis DB 15, launch source with
  `REDIS_DB=15 pnpm exec turbo run dev --env-mode=loose`. The shorter `pnpm dev`
  uses Turbo's strict environment filtering and can drop `REDIS_DB` because the
  `dev` task does not allowlist it. Before browser checks, verify application
  Redis clients use `db=15`; `/health/ready` only proves connectivity.

## Database safety

- Standing permission: see `Autonomy in the local MVP`. Credentials and any
  target beyond this repository's local disposable scope still need separate
  authority.
- **The only disposable database candidates are `customreport_e2e` and the
  runtime-lane targets `customreport_e2e_lane_[a-o]_test`.** Destructive database
  work may target only those exact non-production databases.
- **MVP database policy.** By default, local dev (`DATABASE_URL`), tests, and
  E2E runs share the loopback `customreport_e2e` database (owner decision
  2026-09-18). Two acceptance lanes are separately authorized: the existing
  `customreport_e2e_lane_a_test` and `customreport_e2e_lane_b_test` databases
  for isolated runs. Other lane targets remain
  unprovisioned and must not be created without a new owner order. Every phase
  reset wipes its selected database — keep no long-lived data in these targets.
  Before each test/E2E phase, run a guarded reset plus the explicit required
  seed, so phases never inherit each other's state.
  Resolve the target from `E2E_DATABASE_URL` (or the command's explicit
  database URL), print it with credentials masked, prove that it is
  loopback-only and not production, shared, or unknown, and require
  `prisma/guards/_destructive-guard.ts` to accept it before every destructive
  command.
- Set the mechanical guard token on every destructive operation:
  `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай'`. It is required per
  command under the standing permission too — setting it does not need a new
  chat prompt. Never bypass the guard.
- Prisma 7 quirk: `migrate reset` does NOT auto-seed; run the required seed
  explicitly with the same consent token after a successful reset.
- Redis connections require explicit `REDIS_DB`. Product/dev environments use
  logical DB 0; E2E on `customreport_e2e` uses reserved logical DB 15, and the
  runtime lanes `customreport_e2e_lane_[a-l]_test` use logical DB 1..12 (a=1 …
  l=12). Destructive E2E Redis cleanup must select the DB derived from the
  guarded database name, pass the exact disposable PostgreSQL guard and the
  per-command consent token, and must never flush DB 0, 13 or 14.

## Migration policy

While no production database exists (MVP), the canonical init migration may be
re-baselined; git history shows it edited after the additive migrations, and
`prisma/migrations/canonical-init-contract.test.ts` guards its shape. From the
first production deployment, migrations are forward-only: never edit an applied
migration, add a new one.

## Load-Bearing Invariants

The Report lifecycle tuple of the period dual-state is enforced by the
`Report_lifecycle_tuple_check` constraint; the other two invariants are
enforced only by code review and CI. Any change to a write path must respect
them and link the relevant `openspec/specs/` spec.

- **Period dual-state.** A Report carries canonical `periodState` plus its
  companion lifecycle tuple (`status`, `periodStatus`, `archived`, audit flags,
  and applicable timestamps); lifecycle writers must update them atomically.
- **Role-coverage gate.** tRPC procedures must use one of the 7 canonical
  middleware-chain builders, including `leadProcedure` (matched by reference
  identity). Don't hand-roll a chain.
- **Weekly-cycle rollover.** Rollover creates at most one active W+1 item per
  `stableId`: an explicit Next commitment wins, otherwise unfinished Current
  in-progress continues. Previous stays read-only, and editable Current/Next
  items take one primary `Update progress` action through the canonical
  editor.

## Conventions

- **`docs/` is curated product documentation only** (index:
  `docs/README.md`). Temporary review data and run artifacts stay outside the
  repository.

- **onUI visual review.** Use the external `onui-local` MCP on the canonical
  WeeklyReport origin `http://localhost:3000`. Before UI edits, list pages and
  read the relevant annotations at `standard` detail, then name the annotation
  IDs and your interpretation. Ask about ambiguity in chat. Resolve or delete
  an annotation only after its literal requirement is tied to changed sources,
  an applicable automated check, and browser verification; onUI status never
  changes report or review lifecycle state.

- **OpenSpec is the source of truth.** Read `openspec list` + `openspec/specs/`
  before changing query semantics or behavior; non-trivial work starts as a change.
  `openspec archive` and `openspec init` write into `openspec/changes/archive/`,
  which the cleanliness gate forbids: after either, delete its contents;
  durable knowledge lives in `openspec/specs/`, history in git.
- **UI strings stay English** in `apps/web/src/**/*.tsx` (JSX/toast/aria/placeholder).
  Russian allowed only as DB/seed data, comments, and test fixtures.
  Check changed files: `grep -nE '[а-яА-Я]' <file>` — every hit must be data/comment/test.
- **Quality standard.** Follow `docs/exemplary-code-standard.md` and the
  repository gates. Do not add per-file lint exemptions. The only legacy
  suppression baseline is `eslint-suppressions.json`, limited to
  `max-lines-per-function` and `max-params`. It may only shrink: never add
  entries, increase counts, or add rules.
- **Product configuration fails closed.** Required values have no silent default;
  validate with Zod, read through `requireEnv`, and supply them per environment.
- **Comments record current rationale only.** Keep them short and remove
  changelog archaeology. JSDoc is required only for public exports from
  `packages/shared` and `packages/ui`; TypeScript already carries type details.
- **Markers are traceable.** Use `TODO(<ref>): short imperative note`; remove
  stale or unreferenced `TODO`/`FIXME`/`HACK`/`XXX` markers.

## Gates

The repository lives on the private corporate GitLab (`gitlab` is the only
remote). `.gitlab-ci.yml` is the CI that targets this
remote and carries lint/test lanes (owner decision 2026-09-28): quality,
coverage, API integration, migrate-reset, and the dependency audit on the
shared Docker runner, with in-job loopback PostgreSQL and Redis/Mailpit service
aliases, plus a gated rootless-BuildKit image build and an optional manual
Helm deploy (owner decision 2026-10-01) — no DinD or operational checks. Production build, PDF, and browser acceptance stay outside CI. Do not treat a
runnable GitLab pipeline as full acceptance. Use `docs/exemplary-code-standard.md#verification` for local
acceptance.

## Task completion

Before reporting a change done, run the checks in
`docs/exemplary-code-standard.md#verification` and report their results; a check
that was not run or was blocked does not count as passed. Stage only task-owned changes (concurrent sessions edit
this repo); remove task-owned worktrees, dev servers and containers at session
end once their content is committed or archived.

## Browser verification

Owner decision 2026-09-20: agent-browser (Vercel) is the
selected route for exercising the running app; the Reticle integration is
removed. Verified on source runs (`next dev`, `customreport_e2e`,
2026-09-29/30): Lead sign-in, save, submit and reopen; Head approve; Head
Request changes with a comment and the Lead seeing that reason; Viewer
read-only; Admin DLQ; period reopen, resubmit and republish; the limit dialog;
the Publish now confirmation; the lead-based progress denominator (Head and
Admin Periods); PDF export through a local Gotenberg container; the Unplanned
badge; the reduced-motion login tagline. `pnpm build` succeeds, but the built
output has not been exercised in a browser. Do not claim a
flow beyond this list without fresh evidence. Judge a browser flow by its observable result (snapshot, DOM, network or
screenshot); an unknown or failed result is not a pass. The database-safety
and permission boundaries above apply unchanged.
