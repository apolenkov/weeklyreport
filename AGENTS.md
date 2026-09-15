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

<!-- reticle:begin (managed by `reticle init` — edit outside these markers) -->

## Verifying with Reticle

This app is instrumented by **Reticle**, an in-app verification layer exposed as `reticle_*` MCP tools and the `npx @reticlehq/server` CLI (always through npx: Reticle's server is not installed into this project). Verifying is part of "done", not an optional extra.

**Verify when you have changed something a user can see or do.** A component, a form, a route, a request, a piece of state that reaches the screen. Do it BEFORE telling the user it is complete. Reading the diff proves nothing and unit tests do not run the app.

**Do not reach for Reticle when the change cannot show up in the running app.** It costs tool calls and the user's patience, and a verdict over an unrelated flow proves nothing about what you changed. Skip it for: documentation, comments, tests, build config, CI, dependency bumps with no user-facing effect, backend or CLI work with no UI surface, and any change to a project that is not a running web app. Say in one line that you skipped verification and why, rather than silently not doing it.

**How to verify:**

- Drive the flow with `reticle_act_and_wait({ ref, action, until })`. It names the consequence you expect BEFORE the action, which is the difference between a check and a rationalisation.
- Batch a multi-step journey (a login, a form) into one `reticle_act_sequence` rather than one round trip per field.
- Read the surrounding evidence with `reticle_snapshot`, `reticle_state`, `reticle_network`, `reticle_console`.
- **Only `reticle_act_and_wait` and `reticle_assert` produce a verdict.** `reticle_act` and everything else move or read the app and prove nothing, so a session ending without one of those two has no result however many tools it used.
- Covered flows: `npx @reticlehq/server gate` reports which recorded flows the changed files affect and whether they still pass.

**Setting Reticle up, or just restarted? You are mid-sequence — do not stop until a verdict exists.**
The whole of it is: instrument the app → get a dev server running → open the app in a browser →
drive one flow → report the verdict. Every step is yours to do, and none of them needs the user.
The ONE legitimate pause is a client restart, because a client reads its server list at startup;
when you come back, you are not finished, you are on the next step — resume it without being asked.
Stopping anywhere else leaves an app that looks installed and can verify nothing, which is the
single commonest way this goes wrong. `/reticle` carries the full recovery ladder when a step
does not work; use it rather than guessing, and never report the install as finished without a
verdict to point at.

**Nothing connected? Get the app running.**

**A dev server already running when `reticle init` ran does not have Reticle in its bundle.** It read the build config at boot; `init` edited it afterwards. It serves the old bundle and no session appears. In order:

1. **A dev server was already running?** Restart it, then hard-reload the tab. "Something is listening" does not mean the right bundle is served.
2. **Nothing was running?** Start it in the BACKGROUND and say so in one line. `reticle_sessions` gives you this project's own dev command in `next_action`; use that, never compose one. Started after `init`, it needs no restart.

Stopping to ask is how a verification turn ends with nothing verified.

Four guards, none optional:

1. **Never run two at once.** One dev server on the app's port. Restarting a stale one means stopping it first, not starting a second alongside it.
2. **Never guess the command.** It comes from `package.json` scripts. No recognisable dev script means say so and stop, not invent one.
3. **Never kill anything you did not start**, and never a daemon or a port holder. The one exception is the restart above, and say in one line that you did it.
4. **The permission prompt belongs to your host.** Never bypass, suppress or auto-approve it, and take a refusal as the answer.

A dev server that is already running does not pick up an edited build config or a newly created plugin file — restart it and hard-reload the tab. And if a server IS listening and still nothing connects, the cause is the SDK not loading in the page, not a missing dev server; do not tell the user to start one they are already running.

**Finish `src/reticle-dev.ts` before you claim setup is done.** `init` writes it and cannot always fill it in: a store that needs an argument only reading the code supplies (Jotai atoms, an XState actor, a TanStack `queryClient`) is left as a commented `registerStore` line. A file that registers nothing looks exactly like a finished one, and `reticle_state` then returns empty forever — which is indistinguishable from an app that has nothing to report, so it reads as success. Uncomment the line, complete it, and prove it by driving one flow and seeing your keys come back. If `init` told you to restart your client, this is the job waiting for you on the other side of that restart.

**Verify each feature as you finish it, not all of them at the end.** Asked for four, build one, drive it, get a verdict, then start the second. A red verdict after four builds has four suspects; after one it has none.

**Capture what a change is FOR while you are building it, not afterwards.** `reticle_intent` records the business outcome a change is meant to produce, and the only moment anybody knows it is while the change is being made. Pass `intent` when you save a flow, so the saved flow carries the reason it exists. A flow without one replays for months and then reports "step 3 failed" instead of what stopped being true for a user.

**Honesty, which is the whole point:**

- **`verified: "unknown"` is not a pass.** It means Reticle drove the app and could not tell what happened; `verifiedReason` says which clause decided that. Report it as unknown, never as working.
- **`verified: "no-fault"` is not a pass either.** It means nothing was DECLARED to prove: the page settled and no channel complained, but you asserted nothing, so there is no verification. You get it whenever `until` is omitted. Name a consequence the action changes — a signal, a request, a route, or store state — and call again.
- **Never weaken a check to make it green.** Downgrading, skipping or deleting an assertion is a finding, not a fix.
- **If Reticle cannot run** (no daemon, or this is not a running web app), say so. Do not skip verification silently.
- **Setup is not finished until one real flow has been driven and produced a verdict.** `init` exiting 0, the tools appearing, and a session being listed are all things that happen before anything has been verified.

**The `/reticle` skill runs this whole loop for you** — detect, connect, drive one flow, report. If your client does not have it, install it once: `/plugin marketplace add reticlehq/reticle` then `/plugin install reticle@reticlehq` in Claude Code, or `npx skills add reticlehq/reticle` anywhere the skills CLI works.

**A tool you need is missing? It exists.** The default surface advertises a subset; reach any other by name with `reticle_run { tool, args }`, and list them with `reticle_tools`. Two worth knowing: `reticle_context` returns this run's own memory — what is established, what is proven, what is still unverified — which is what you want after a compaction or when picking up work you did not start; `reticle_intent` records what a change was MEANT to do, while somebody still knows.

**Report Reticle's own defects with `reticle_feedback` the moment you notice**, then carry on with your task. You are the user Reticle is built for and the only one who can say what it cost you, and that knowledge is gone when your context is.

📄 **The rest is in [RETICLE.md](./RETICLE.md): what to do when the tools are missing, when a result carries `version_skew` or `update_available`, when `reticle_state` comes back empty, and how to write a feedback report that can be acted on. Read it when you hit one of those, not before.**
<!-- reticle:end -->
