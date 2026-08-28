# Exemplary Code Standard

Status: LIVE — the ratchets in §2 are enforced via `eslint.config.ts` and the
pre-commit/pre-push hooks (see below). This document defines the active targets
(file size ≤230 lines, function size ≤57 lines, cyclomatic complexity ≤10,
cognitive complexity <10) and the maintenance workflow.

---

## 0. Operating constraints (read first)

- **Keep each standard/refactor unit independently reviewable and revertable.**
  Never fold a risky ratchet into an unrelated product change.
- **Verify every folder before moving on**: `pnpm typecheck && pnpm lint &&
pnpm test && pnpm build` green, plus a live boot from source where a boot path
  changed (recipe: memory `api-live-verify-from-source`).

## 1. Principles (the WHY — these decide ambiguous cases)

1. **Explicit over implicit. No fallbacks, no silent defaults.** A `?? "localhost"`
   in code or a `.default()` in a config schema HIDES whether a value is
   mandatory and lets a misconfigured deploy boot with a wrong value. Product
   config is REQUIRED, read via `requireEnv`, and supplied explicitly per
   environment (`.env`, every `docker-compose*.yml`, the e2e env). Boot fails
   loud on a missing var. Apply the same requirement everywhere, including
   remaining `${VAR:-default}` shell fallbacks in dev/base compose.)
2. **No crutches (костыли), no non-obvious magic.** Every literal a reader can't
   explain at a glance is a smell: name it with a documented constant or remove
   it. Example flagged by the user: `standardHeaders: "draft-7"` — either a named
   constant with a one-line rationale, or gone. Simple and clear beats clever.
3. **Comment hygiene — terse WHY, relocation-first** (spec:
   `lint-max-strictness-standard`, delta `tighten-comment-policy`). Default is
   NO comment: code a competent reader follows from names and types carries
   none. A comment is justified only for a non-obvious WHY the code cannot
   express, within a THREE-LINE budget. Delete change-log / ticket / phase
   archaeology (`Phase 35-08`, `UFB-036`, `AUTH-08`, …) — repository history holds
   that — and JSDoc blocks on app-internal functions (JSDoc is public-API-only
   per the spec). Enforced by the `local/no-comment-archaeology` ESLint rule
   (`tools/eslint-rules/`), scoped to `apps/`, `packages/` and `prisma/`, so it
   runs in `pnpm lint` AND in lint-staged on every commit; the rule covers
   comments AND test titles (`describe`/`it`/`test` and their variants), so
   archaeology can't hide by moving out of a `//` comment. Load-bearing rationale that exceeds the budget is RELOCATED,
   not deleted: verify (or add) the covering `openspec/specs/` requirement or
   ADR first, then compress the comment to ≤2 lines, optionally naming the
   spec — a live spec name is a pointer, not archaeology. Sweeps touching
   security-sensitive paths (auth, JWT, cookies, redirects, rate-limit, CSRF,
   secrets, authz — non-exhaustive) pass a security review. In-budget example
   (the KEEP shape): "ipKeyGenerator: /64-mask IPv6 so one host can't dodge
   the limiter by rotating suffixes (ERR_ERL advisory)" — three lines, pure
   WHY, no ticket prefix.
4. **Functional and immutable.** `const` only; no `let`, no reassignment, no
   in-place mutation, no parameter mutation. Build new values with
   `map`/`filter`/`reduce`/spread. Pure functions; side effects isolated.
5. **Small, single-purpose units** (see thresholds below).
6. **Exemplary WITHOUT exemption — zero exemptions, zero warnings, zero errors.**
   "Lint-green" means `eslint` runs with `--max-warnings 0` (warnings ARE
   failures) AND there is NO entry for the file in any `eslint.config.ts`
   exempt/override list. Removing the exemption is the done-signal, not silencing
   the rule; a surviving warning is not "green".
7. **Correct architecture.** A module owns only its domain; cross-domain logic is
   delegated via injection (composition root wires it). dev and prod are split by
   explicit env files and dev-only modules, not by in-code branches with
   fallbacks.

## 2. Hard thresholds (the WHAT — ESLint, `src` only)

All rows below are live in `eslint.config.ts` today:

| Area                                                                                                 | Ratified rule                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `max-lines` (skipBlankLines, skipComments)                                                           | **230** for maintained product source, enforced `error` across `apps/api/src`, `apps/web/src`, `packages/shared/src`, and `packages/ui/src`.                                                                                                                                                                                                             |
| `max-lines-per-function`                                                                             | **57** for maintained product source, enforced `error`; tests, fixtures, harnesses, UAT and E2E have no structural size/complexity budgets.                                                                                                                                                                                                              |
| `sonarjs/cognitive-complexity`                                                                       | **Below 10** for maintained product source (`9` is the configured maximum), enforced `error`.                                                                                                                                                                                                                                                            |
| `complexity` (cyclomatic)                                                                            | **10** for maintained product source, enforced `error`.                                                                                                                                                                                                                                                                                                  |
| `prefer-const` / `no-var`                                                                            | Global `error`.                                                                                                                                                                                                                                                                                                                                          |
| `no let`                                                                                             | `no-restricted-syntax` bans `let` in production source (`apps/api`, `apps/web`, `packages/shared`, `packages/ui`), enforced `error`. Tests, `src/test-utils`, seeds, e2e, and tooling stay out of scope. A load-bearing mutable binding survives only behind an inline disable with a concrete WHY.                                                      |
| `no-param-reassign`                                                                                  | Global `props:false` (parameter rebinding banned), enforced `error`. `trpc.session-hydration.ts` is stricter with `props:true` because caller-owned `UserSession` mutation can leak authz/session scope.                                                                                                                                                 |
| `functional/immutable-data`                                                                          | Enforced `error`, scoped to pure layers only: `apps/api/src/modules/**/domain/**/*.ts` and `packages/shared/src/**/*.ts`, excluding tests, with `ignoreClasses:true` and `ignoreImmediateMutation:true`. Not repo-wide by design; infra/UI/Prisma builders/React refs are intentionally out of scope.                                                    |
| Import-boundary zones (hexagon domain purity, port-type boundary, api cross-module, web cross-slice) | Enforced `error` via `import-x/no-restricted-paths` and `@typescript-eslint/no-restricted-imports`, ratcheted with per-consumer allowlists that shrink monotonically; `eslint-disable` of these specific rules is banned repo-wide (`@eslint-community/eslint-comments/no-restricted-disable`), so the config allowlist is the only grandfathering path. |
| `pnpm lint` posture                                                                                  | `--max-warnings 0` — zero errors AND zero warnings gate the pre-push hook (see below).                                                                                                                                                                                                                                                                   |
| Per-folder/per-file structural exemptions in maintained product source                               | **None.** Inline structural suppressions and path-specific weakenings fail the floor ratchet. Separately measured roles are classified with an owner and rationale rather than hidden behind a product-path exemption.                                                                                                                                   |

Gate wiring: `.husky/pre-commit` runs lint-staged on staged files — ESLint
`--fix` (which carries `local/no-comment-archaeology` over comments and test
titles), Stylelint for CSS, and Prettier. `.husky/pre-push` runs
`pnpm turbo typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm catalog:check`,
`pnpm uat:audit --check`, and `CI=true pnpm test`; the same core commands run in
the push, pull-request, and manual-dispatch jobs in `.github/workflows/ci.yml`.

The current `scripts/gates/orchestrator/lint-gate.ts` runs every configured
check by default; `pnpm lint --fail-fast` is the explicit opt-in to stop
after the first failure. The aggregate includes the Prettier scope probe
(`pnpm lint:prettier-scope:test`), while the formatter owner itself remains the
separate `pnpm format:check` command. This distinction is intentional in the
matrix below and must not be reported as formatter evidence when only the scope
probe passed.

The active rule set is composed by the typed modules under `eslint-config/`:
ESLint owns semantic and structural TS/JS checks, Prettier owns formatting, and
Stylelint owns CSS. No ESLint layout rule duplicates Prettier. The exact owner,
command, scope, exclusions, and planted-probe evidence are recorded in the
external `~/work/customreport-archive/2026-07-30-exhaustive-style-audit/TOOLCHAIN-AUDIT.md`
and verified against the current tree; where rules conflict, document a
one-line WHY for the deliberate opt-out (never a blanket disable).

Tests, fixtures, harnesses, UAT and E2E stay outside production structural,
complexity and immutability budgets and test-style preferences. They retain
formatting plus applicable type-aware safety and failure-prevention rules such
as rejecting focused tests, duplicate hooks and invalid asynchronous
expectations. Generated sources, config and tooling keep their explicit role
policies. None of these scopes weakens the maintained-product floor.

## 3. Rollout method (per folder — the proven sequence)

Use this sequence for each folder:

1. **Recon** — read every file + its `openspec/specs/**`. Find what the module
   wrongly OWNS (cross-domain logic/persistence).
2. **Delegate out via injection** — move it home; receive a narrow injected fn
   wired in the composition root. The other module stops importing this one.
3. **Split god-files** into single-purpose files until each is ≤ 230 lines.
4. **Extract functions** until each is ≤ 57 lines, cyclomatic complexity ≤ 10,
   and cognitive complexity < 10.
5. **Kill fallbacks/magic, enforce immutability** per §1.
6. **Confirm the global maintained-product floor applies** through effective
   config and planted probes. The done-signal is BOTH gates: exemption-free lint AND a
   comment-policy review pass (§1.3) — no lint rule judges comment noise, so
   lint-green alone is NOT comment-clean. Post-sweep drift is caught by
   standing PR review (reviewer/agent diligence), not by waiting for the next
   sweep.
7. **Dedup** — lift shared helpers to `lib/`; use canonical sources (e.g. a Zod
   schema, never a hand-maintained list).
8. **Verify (layered)** → **archive** any OpenSpec change.

## 4. Folder order (suggested; adjust on recon)

1. `apps/api/src/modules/*` (period, reminders,
   pdf-export, admin, report-sections, organization, …)
2. `apps/api/src/infrastructure/*`
3. `apps/web/src/*` (components, then app routes)
4. `packages/shared`, `packages/ui`

The initial rollout tightened one measured slice at a time and enabled the
global maintained-product authority only after every slice reached zero. New
product paths inherit that authority immediately; there is no transitional
per-folder override phase anymore.

## 5. OpenSpec backlog (≈34 active changes)

`openspec list` shows the current backlog:

1. Triage: for each change, `openspec show <name>` → state = (proposal only |
   specced | partially implemented | ready). Group by risk.
2. Implement ready/low-risk ones first, gate, and archive.
3. High-stakes ones (auth/schema/concurrency/migrations) → run `/grill-me-codex`
   or `/codex-review` on the plan first, then implement, then `/code-review`.
4. Some may be obsolete post-overhaul — close with a note, don't implement blind.

## 6. Operating workflow

1. Read this standard and the relevant `openspec/specs/` requirements.
2. Run the rollout sequence for one module at a time, starting with one module
   to calibrate before scaling.
3. After each folder: gates green, exemption removed, and evidence archived.

## 7. Done definition (whole repo)

- maintained product `src` follows the active §2 ratchets: `max-lines` 230,
  function size 57, cyclomatic complexity 10, cognitive complexity below 10,
  zero structural exemptions, production-source `no let`, global
  `prefer-const` / `no-var` / `no-param-reassign`, and scoped
  `functional/immutable-data` for pure layers.
- `pnpm lint` runs clean with `--max-warnings 0` — **zero errors AND zero
  warnings** across the repo (a warning is a failure, not an acceptable state).
- Zero config fallbacks/defaults for product-critical values; boot fails loud.
- Every folder passed the comment-policy review (§1.3: 3-line WHY budget,
  relocation-first) — a review gate, additional to and never implied by
  lint-green.
- Individually curated strict rule set active (see §2), Prettier-reconciled.
- The OpenSpec backlog triaged: implemented+archived or explicitly closed.
- Every overhaul step has independently reviewable evidence and a reversible
  change.
