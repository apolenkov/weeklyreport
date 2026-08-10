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

## RTK usage

- RTK is optional output compression, not an acceptance gate. Use it only for
  supported read-only commands when losing formatting or long-line detail does
  not remove decision-critical evidence.
- Suitable commands: large `git status`, `git log`, `git diff`, `rg`, directory,
  and dependency-listing output. Re-run the original command for exact paths,
  complete lines, or evidence artifacts.
- Never wrap Vitest, Playwright, runtime-sweep, acceptance-evidence, database,
  migration, or aggregate `pnpm lint` commands in RTK.

## Runtime

- Web `http://localhost:3000`, API `http://localhost:3002`, Mailpit UI `http://localhost:8025`.
- Dev auth: `AUTH_DEV_MODE=true` + `/auth/dev-login`; refused at boot when `NODE_ENV=production`.
- `NEXT_PUBLIC_DEV_ROLE_SWITCHER=true` shows the dev-only role switcher.
- The docker `web`/`api` containers serve a STALE built image; to live-verify new
  code, run the app from source using `docs/onboarding.md` or `pnpm dev`.

## MVP Phase — current

No production point exists yet. This OVERRIDES the global "branch first / commit
only when asked / append-only migrations" caution. Ends at first production point.

- **Commit and push directly to `main` is pre-authorized.** No feature branch,
  no per-action confirm. Never push a red tree; on a shared worktree stage only your paths.
- **The locally authorized disposable databases are `customreport_e2e` and the
  runtime-lane targets `customreport_e2e_lane_[a-o]_test`.** Reset, reseed, and
  migration replay are allowed only for those exact non-production targets.
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
- **Exemplary by default.** This repo is a reference others copy: take the clean
  path over the quick one. Functional and immutable — prefer `const`, pure functions,
  `map`/`filter`/`reduce` + spread; avoid `let`, reassignment, in-place mutation.
  Small single-purpose units; tighten lint via the repo-wide ratchet, never per-folder.
- **Hard standard → `docs/exemplary-code-standard.md`.** The target the codebase
  is being rolled out to: files ≤ 300 lines, functions ≤ 70, cognitive complexity
  < 10, zero `let`/mutation, and the no-fallback rule below. "Done" = `eslint`
  clean with `--max-warnings 0` (zero errors AND zero warnings) and NO
  `eslint.config.ts` exempt entry for the file.
- **No fallbacks, no silent defaults for product config.** A `?? "localhost"` in
  code or a `.default()` in `env.schema` hides whether a value is mandatory. Make
  it REQUIRED (Zod, no default), read via `requireEnv`, supply explicitly per
  environment; boot must fail loud on a missing var. No non-obvious magic literals —
  name+document or remove.
- **Comment hygiene — no archaeology.** Comments explain the non-obvious WHY of
  the current code (≤3 lines). Delete change-log/ticket/phase refs (`Phase 35-08`,
  `UFB-036`, `AUTH-08`, `FIX-02`, `R3a-4`, …) — git history holds that. Keep
  load-bearing rationale, rewritten without the prefix; never narrate what the
  code already says. Over-budget load-bearing WHY relocates to `openspec/specs/`
  (leave a ≤2-line pointer) — do not silent-delete.
- **Doc / comment / marker hygiene (for agents).** Full audit+fix lane uses
  `pnpm lint` and the relevant checks under `scripts/gates/`; the measured
  quality procedure is `.codex/skills/exemplary-audit/SKILL.md`.
  - **JSDoc** is public-API-only: required on exported surface of
    `packages/shared` and `packages/ui`; **remove** from `apps/*`, Nest, tRPC,
    and non-exported helpers. When required, fill to SHAPE: English; first line
    is the contract (not a name restatement); `@param`/`@returns`/`@throws` only
    when types are insufficient; no `@example` walls, no archaeology, no
    implementation walkthrough.
  - **Markers:** canonical form `TODO(<ref>): short imperative note`. Bare
    `TODO`/`FIXME`/`HACK`/`XXX` without `(<ref>)` is a defect; convert or remove.
    Stale markers (work already done) must be deleted. Deferred features follow
    `openspec/specs/deferred-feature-pattern` (loud stub + matching `TODO(<ref>)`,
    or UI `ComingSoonBadge`) — never a hidden flag.
- **Exemplary quality stack.** Use `.codex/skills/exemplary-audit/SKILL.md` for
  measured quality checks, `pnpm lint` and targeted `scripts/gates/` checks for
  enforcement, and `.codex/skills/web-design-guidelines/SKILL.md` for UI reviews.
- **ESLint is the strict mechanical floor (no JSDoc tag overhead).**
  `packages/shared` + `packages/ui`: `jsdoc/require-jsdoc` **error** on
  **public exports only** (`publicOnly`) — short `/** contract */` required.
  `require-param` / `require-returns` / type tags stay **off** (TypeScript
  already carries them). Tag correctness (`check-param-names`,
  `check-tag-names`) stays **error** when tags exist. Apps stay off
  require-jsdoc; internal JSDoc is removed by hygiene review, not forced.

## Gates

`.husky/pre-commit` runs lint-staged (eslint + stylelint + prettier on staged files).
`.husky/pre-push` runs typecheck, the full lint gate, format check, catalog drift,
mutation-consumer audit, and the full unit suite (skip with `SKIP_PREPUSH=1`).
CI (`.github/workflows/ci.yml`) runs on every push to `main`, on pull requests,
and on manual dispatch. Local hooks are the first gate, not the only one.
Pushing a new app route trips the catalog-drift gate: add a scenario to
`e2e/catalog/<role>.yaml` (or `EXCLUDED_ROUTES`) and re-run `pnpm catalog:check`.
