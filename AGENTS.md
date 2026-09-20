# AGENTS.md

This file provides guidance to Codex when working with code in this repository.

Global language and response-style preferences live in `~/.codex/AGENTS.md`.
Keep this file limited to WeeklyReport-specific context.

## Autonomy in the local MVP

- Treat this checkout as an actively developed MVP, not a production release.
  Within the requested task, proceed with local implementation, diagnostics,
  tests, browser checks, and recoverable changes to identified synthetic test
  records without asking for each step. This includes creating/editing records
  and exercising submit, review, and reopen flows in a verified local test
  environment. `localhost` alone does not prove that its backend is disposable.
- Preserve the task boundary: an audit does not authorize product fixes, and
  explicit read-only instructions override the test-record permission above.
  Do not expand local permission to production, shared/unknown data, credentials,
  paid actions, external messages, or publication. Database safety below still applies.
- Inspect the actual handler before activating a UI control whose side effects
  are unclear. Distinguish opening a form from submitting it and local input from
  autosave. Use known fixtures and record the relevant pre-state before lifecycle
  tests; never infer reversibility from a button label.
- If a test unexpectedly changes state, disclose the effect once, inspect it,
  and recover autonomously when the recovery is known, scoped, and authorized.
  Otherwise isolate that record/scenario and continue independent checks. An
  optional rollback or one unavailable fixture must not block the entire task.
- Resolve routine choices from code, specs, existing data, and tools. Ask only
  when a material decision or new authority is genuinely necessary; name the
  exact affected step and continue all work that does not depend on the answer.
  Do not repeatedly request confirmation for an already authorized action.
- After at least two explicit requests for the same owner decision receive no
  answer and all independent work is exhausted, invoke one bounded read-only
  `astra_advisor` on that unresolved choice. For reversible local-MVP product,
  architecture, risk, scope, or trade-off decisions, the coordinator may adopt
  a clear advisor recommendation and continue autonomously, recording the
  reason, verdict, assumptions, and resulting decision in Backlog/OpenSpec as
  applicable. An inconclusive or conflicting verdict still returns to the
  owner. This delegation does not authorize production/shared/unknown data,
  credentials, paid actions, external messages or publication, destructive
  operations without separate applicable owner authorization, or changes to
  agreed acceptance criteria.
- Keep acceptance evidence proportional and explicit: define the finite test
  matrix, reuse equivalent evidence without hiding exclusions, and report gaps.
  Finish the requested outcome; do not replace it with repeated plans, status
  messages, or an arbitrary screenshot count. Do not mark a goal blocked while
  meaningful independent work remains, or complete while required checks remain.

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
pnpm format:check       # Prettier check without rewriting files
pnpm test               # package unit suites plus root safety tests
pnpm build              # turbo run build
pnpm spec:check         # strict validation of all durable OpenSpec specs
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
- Dev auth: `AUTH_DEV_MODE=true` + `/auth/dev-login`; refused at boot when `NODE_ENV=production`.
- `NEXT_PUBLIC_DEV_ROLE_SWITCHER=true` shows the dev-only role switcher.
- Verify that the running app includes the changed sources before browser
  acceptance. An existing Docker image may predate the change; use the source
  workflow in `docs/onboarding.md` or `pnpm dev` when appropriate.

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
- **Role-coverage gate.** tRPC procedures must use one of the 7 canonical
  middleware-chain builders, including `leadProcedure` (matched by reference
  identity). Don't hand-roll a chain.

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
and on manual dispatch. Use `docs/exemplary-code-standard.md#verification`
for local acceptance; the workflow is authoritative for CI jobs and conditions.

## Task completion

- Before editing, inspect the working tree and identify the files owned by this
  task. Preserve pre-existing and concurrent edits, including edits in the same
  file. Stage only task-owned changes; never clean up another task's work to
  obtain a clean status.
- Derive acceptance from the user's requested outcome and the relevant OpenSpec
  contract. Include required checks and any requested commit, push, publication,
  or live verification. Existing authorization remains valid within its scope;
  do not add external delivery to a local task.
- Tie results to the tested commit and relevant uncommitted changes. Reuse prior
  passing checks only when their inputs remain applicable. Record unavailable
  checks and exclusions explicitly; do not present them as passes.
- Before finishing, inspect the task diff, remove temporary artifacts created
  by this task, and reconcile affected instructions and specs with the result.
  Report what changed, what passed, and the actual commit/push/publication state.
  Completion requires every agreed delivery step; locally saved progress alone
  does not complete a task whose requested delivery is still pending.

## Browser verification

Owner decision 2026-09-20 (backlog TASK-047): agent-browser (Vercel) is the
selected route for exercising the running app; the Reticle integration is
removed. Tool-level runtime proof exists (navigation + screenshot on
agent-browser 0.38.1); WeeklyReport UI acceptance through it is still pending —
do not claim the route verifies this app until one real flow has produced
verified evidence.

- Name the explicit observable consequence before acting: a rendered change, a
  network request, or a route/state transition. An action with no declared
  consequence proves nothing.
- Capture the evidence the claim needs — screenshots, DOM, and/or network
  observations of the real app, not retold summaries.
- Bind results to source identity (commit plus task-owned uncommitted files)
  and a finite scenario set; report exclusions and gaps explicitly.
- A failed or unknown outcome is not a PASS; report it as such.
- Never weaken product acceptance to make a check green, and never present the
  replacement route as working before its first verified flow. The
  database-safety and permission boundaries above apply unchanged.
