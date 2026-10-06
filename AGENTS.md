# AGENTS.md

Guidance for coding agents in this repository. WeeklyReport automates the CoreDev weekly status
reports (Leads fill sections, the Head reviews, publishes and exports). pnpm + Turbo monorepo; the
layout is visible in the tree and READMEs. Non-obvious: `packages/migrator-runtime` only pins the
Prisma CLI for the minimal migration image; `packages/report-persistence` is server-only.

## Autonomy in the local MVP

- This checkout is an actively developed MVP, not a release. Within the requested task, proceed
  with local implementation, diagnostics, tests, browser checks and recoverable changes to
  identified synthetic records without asking per step. `localhost` alone does not prove a backend
  is disposable.
- **Standing local synthetic-database authority (owner decision 2026-09-23).** For the exact,
  guard-approved targets under Database safety the owner grants standing permission for any
  database operation the task needs: queries, record changes, schema and migration changes
  (including migration-history repair), reset, truncate, drop/recreate and reseed. Do not ask per
  run, table or record. Before every destructive operation still verify the exact target, use the
  repository guard with its consent token, and coordinate concurrent sessions. This does not cover
  unprovisioned lane databases or any production, shared or unknown target. It also covers
  cleaning Redis DB 15, restarting local repository processes, recreating repository-scoped local
  Docker resources and removing generated runtime/build/cache state.
- An audit does not authorize product fixes; explicit read-only instructions override the above.
  Never extend this to production, shared or unknown data, credentials, paid actions, external
  messages or publication.
- Inspect the real handler before activating a control with unclear side effects; record the
  pre-state before lifecycle tests. If a test changes state unexpectedly, disclose it once,
  recover when the recovery is known and authorized, otherwise isolate the record and continue.

## Database safety

- Disposable candidates are only `customreport_e2e` and the lane targets
  `customreport_e2e_lane_[a-o]_test`; only lanes `a` and `b` are provisioned, never create others
  without a new owner order. Local dev, tests and E2E share `customreport_e2e` by default
  (owner decision 2026-09-18). Every phase reset wipes its database: keep no long-lived data.
- Before each test/E2E phase run a guarded reset plus the explicit seed. Resolve the target from
  `E2E_DATABASE_URL` (or the command's explicit URL), print it with credentials masked, prove it is
  loopback-only and not production, and require `prisma/guards/_destructive-guard.ts` to accept it.
- Every destructive operation needs `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай'` in its
  environment (per command; no chat prompt needed). Never bypass the guard.
- Prisma 7: `migrate reset` does not auto-seed; run the seed explicitly with the same token.
- Redis needs an explicit `REDIS_DB`: product/dev 0, E2E on `customreport_e2e` 15, lanes `a`..`l` =
  1..12. Destructive Redis cleanup selects the DB derived from the guarded database name and must
  never flush DB 0, 13 or 14.
- Migrations: while no production database exists the canonical init migration may be re-baselined
  (`prisma/migrations/canonical-init-contract.test.ts` guards its shape); after the first
  production deployment migrations are forward-only.

## Commands and runtime

- `pnpm` only (Node 26.10.0, `.nvmrc`). `pnpm deps:up` / `deps:down` run PostgreSQL, Redis, Mailpit
  and Gotenberg in the OrbStack namespace `wr-dev` (ports 5432, 6379, 1025/8025, 3010 must be free;
  no Docker Compose). Web :3000, API :3002. Dev auth: `AUTH_DEV_MODE=true`; refused in production.
- Browser/E2E needs Redis DB 15: `REDIS_DB=15 pnpm exec turbo run dev --env-mode=loose` (plain
  `pnpm dev` drops `REDIS_DB` under Turbo's strict env). Verify the app clients use `db=15`;
  `/health/ready` only proves connectivity. Check that the running app contains your changes
  before browser acceptance. Env for E2E: `E2E_DATABASE_URL` and `DATABASE_URL` from `.env.test`
  and `.env`.
- If the Prisma client is missing or stale: `pnpm --filter @customreport/api db:generate`.
  API database integration: `pnpm --filter @customreport/api test:integration` on a guarded
  disposable database. `pnpm lint` stops at the first failing check.
- When the owner asks to try the product, start it from source, offer a reset to the minimal seed
  through the guarded flow, report URLs and dev roles, diagnose hangs from logs, and stop the
  processes at session end.

## Load-bearing invariants

Respect these in any write path and link the relevant `openspec/specs/` spec. Only the Report
lifecycle tuple is enforced by a DB constraint (`Report_lifecycle_tuple_check`).

- **Period dual-state.** Canonical `periodState` plus the lifecycle tuple (`status`,
  `periodStatus`, `archived`, audit flags, timestamps) are updated atomically.
- **Role-coverage gate.** tRPC procedures use one of the 7 canonical middleware-chain builders,
  including `leadProcedure` (matched by reference identity); never hand-roll a chain.
- **Weekly-cycle rollover.** At most one active W+1 item per `stableId`: an explicit Next
  commitment wins, otherwise unfinished Current in-progress continues; Previous stays read-only.

## Conventions

- OpenSpec is the source of truth: read `openspec list` and `openspec/specs/` before changing
  behavior; non-trivial work starts as a change. After `openspec archive`/`init` delete
  `openspec/changes/archive/` (the cleanliness gate forbids it). `docs/` is curated product
  documentation only; temporary review data stays outside the repository.
- UI strings in `apps/web/src/**/*.tsx` stay English (Russian only in data, comments, fixtures):
  `grep -nE '[а-яА-Я]' <file>`.
- Follow `docs/exemplary-code-standard.md`. No per-file lint exemptions; `eslint-suppressions.json`
  may only shrink. Product configuration fails closed (Zod, `requireEnv`, no silent defaults).
  Comments state current rationale only; markers are `TODO(<ref>): note`.
- onUI visual review: use the `onui-local` MCP on `http://localhost:3000`; list pages and read
  annotations at `standard` detail before UI edits; resolve one only after its requirement is
  tied to changed sources, a check and browser verification.

## Gates, completion, browser

- GitLab is the only remote. `.gitlab-ci.yml` runs lint/test lanes (quality, coverage, API
  integration, migrate-reset, audit), a gated image build and an optional manual Helm deploy; it
  is not full acceptance. Local acceptance: `docs/exemplary-code-standard.md#verification`.
- Before reporting done run those checks and report results; a check not run or blocked does not
  count as passed. Stage only task-owned changes (concurrent sessions edit this repo); remove
  task-owned worktrees, dev servers and containers at session end.
- Browser verification uses agent-browser (Vercel). Judge a flow by its observable result
  (snapshot, DOM, network, screenshot); an unknown or failed result is not a pass. Do not claim a
  flow without fresh evidence.
