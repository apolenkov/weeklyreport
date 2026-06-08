# Tasks

Gates after every code step: `pnpm typecheck && pnpm lint && pnpm test`.

## Preconditions

- [x] SC-P1: Confirm clean working tree on `main`
      (`git status --short --branch`).
- [x] SC-P2: Confirm the catalog pilot `e2e/catalog/carry-over.feature` is the
      agreed reference format before any fan-out.
- [~] SC-P3: Confirm Playwright MCP (or native `e2e/` harness) is reachable for
  the UI tier; if MCP is down, the UI tier uses native specs only.
  → SUPERSEDED 2026-06-08: the UI tier was built (SC-UX) and the durable
  sweep engine now runs via the native `e2e/sweep/` harness
  (`behavioral-ui-regression-gate`, archived), not MCP. MCP-reachability is no
  longer a precondition for this change.

## Build the catalog (Workflow — deferred, run on explicit go)

- [x] SC-1: Enumerate the FULL entry-point surface — tRPC procedures + REST
      controllers + BullMQ processors + cron schedulers + Next route handlers.
      Record the count per module as the fan-out work-list.
      → `e2e/catalog/_entry-points.md` (99 entry points: 86 tRPC + 4 REST +
      3 BullMQ + 4 cron + 2 Next). NB: real tRPC count is 86, not the
      handoff's estimated 128.
- [x] SC-2: Workflow _Extract_: one agent per router/module (+ entry-point
      sweep), Sonnet. Emit `e2e/catalog/<module>.feature` with checkable `Then`,
      a code link, and a covered-by mark per scenario.
      → workflow wvwyuc9n8: 9 features + pilot, 389 scenarios, 75 negative-authz.
      Acceptance: 82/82 tRPC procedure identifiers present, 0 missing.
- [x] SC-3: Workflow _Consolidate + gap critic_: merge/dedup, cross-ref vs the
      152 specs and the Prisma model (26 entities × 17 enums), emit the gap list.
      → `e2e/catalog/_gaps.md`. 3 coverage gaps + 2 dead enums + 2 uncovered enum
      states + 2 spec-drift findings (period-dual-state over-counts writers by 2).
      Iter-1 gap-fill agent closing the 3 coverage gaps + enum states + follow_up.
- [x] SC-4: Workflow _Diff-tag_: mark scenarios whose linked code is in the
      dangerous waves (`no-unnecessary-condition`, `no-misused-promises`,
      `require-await`) = the diff-scoped "verify now" subset.
      → `e2e/catalog/_diff-tags.md` (7 scenarios in the diff-scope).
- [x] SC-5: Emit the coverage matrix (entity/state × entry point × role ×
      covered-by × diff-tag).
      → `e2e/catalog/_matrix.md` (452 rows; 221 test-covered, 231 covered:none).
- [x] SC-UX: (added) UX tier — capture live DOM per role (Playwright), derive
      `e2e/catalog/ui-*.feature` + role×route access matrix. → workflow wgebt6o9g.
      → 4 ui-\* features, 194 UI scenarios, `_ux-matrix.md` + `_ux-findings.md`.
      8 access anomalies; A3 (preview lacks role guard) + A6 (hydration bug)
      code-verified. Iter-2 convergence critic → `_gaps-round2.md` (running).

## Drift gate (first-class)

- [x] SC-6: Add a `catalog:check` command that re-derives the entry-point surface + entity enums and exits non-zero when code exposes surface absent from the
      catalog, naming the uncovered surface.
      → DONE 2026-06-08: `pnpm catalog:check` → `e2e/sweep/catalog-check.mjs`.
      SCOPE PIVOT recorded honestly: the catalog pivoted from the design's
      tRPC-procedure/`.feature` framing to a per-role ROUTE catalog
      (`e2e/catalog/<role>.yaml`; see README "Two levels of completeness"), so
      the checkable surface is the App Router page-route set, NOT tRPC procedures
      or Prisma enums (the catalog tracks neither — nothing to diff against).
      The gate re-derives routes from `apps/web/src/app/**/page.tsx` and runs
      three route-level checks: forward (every code route minus 2 documented
      system excludes — `/print/[reportId]`, `/auth/error` — appears in >=1 role
      catalog), reverse (no stale catalog route absent from code), hygiene
      (clean-URL route value + non-empty `access`, folding in the
      `_generation-notes.md` deterministic checks). Pure Node, reuses the shared
      `catalog-parser.mjs` (extracted from `render-checklist.mjs`). Green at
      commit: 21 code routes (2 excluded), 19 catalog routes, no drift; negative
      test confirmed exit 1 on an uncovered route.
      DEFERRED (out of SC-6 scope, advisor-flagged): per-role exhaustiveness
      ("every role that can reach a route must list it" — stronger than SC-6 asks
      and the catalog is intentionally inconsistent about impersonation-only
      routes, e.g. head/admin omit `/lead/report/[reportId]/preview`); and
      access-vs-guard consistency (needs to model the unguarded root). Left as a
      question for the user, not silently resolved inside this gate.
- [x] SC-7: Wire `catalog:check` into CI as a gate.
      → DONE 2026-06-08: enforced in two places. (1) `.husky/pre-push` runs
      `pnpm catalog:check` before the unit suite — this is the ACTIVE gate, since
      `ci.yml` is `workflow_dispatch`-only with no runners (its own comment:
      "Local pre-push gates remain the active quality gate"). The gate is NOT
      part of `pnpm lint`/`test`, so it had to be added to pre-push explicitly.
      (2) A "Catalog Drift Gate" step in the `quality` job of `ci.yml` (after the
      mutation-consumer audit; no DB/build needed) so it runs once runners exist.

## Diff-scoped verification run (consumes existing changes)

- [x] SC-8: Run the four-command gate chain
      `pnpm typecheck && pnpm lint && pnpm test && pnpm build`; confirm one green
      exit (executes `final-gates-resweep` gate tasks).
      → 2026-06-03 all green: typecheck ✓, lint 0 errors (2 non-gating warns),
      test 579/579 web + cached API ✓, build ✓ (5/5 tasks).
- [~] SC-9: Consolidated per-role runtime sweep (Lead/Head/Admin/Viewer) via
  `/auth/dev-login?role=<ROLE>`, driven by the diff-scoped catalog + the
  a11y interaction checks from `verify-a11y-recommended-flip`; assert 0
  console ERRORS and that each diff-tagged `Then` holds. This single pass
  covers `final-gates-resweep` sweep + `verify-a11y` + `defer-uat` Wave 1.
  → SUPERSEDED 2026-06-08: the per-role runtime sweep is now owned by the
  automated `e2e/sweep/catalog-sweep.spec.ts` (4 roles, 0 console ERRORS —
  ran green this session; `final-gates-resweep` archived on it). The
  remaining keyboard/dialog interaction checks live in `verify-a11y`
  VA-1..VA-9 (live app). Not this change's job.
- [~] SC-10: Targeted manual pass on top-risk flows (the six period writers,
  publish/revoke, carry-over, periods-tab delete dialog).
  → SUPERSEDED 2026-06-08: re-homed to `verify-a11y` VA-2/VA-3 (dialog
  keyboard checks) + the live-UAT Wave 1 of `defer-uat` (§4 user decision).
- [ ] SC-11: Any failure → file a dedicated openspec change; do NOT patch under
      this change.

## Reconcile the live drift finding

- [x] SC-12: Resolve `period-dual-state` ↔ carry-over: determine whether
      carry-over actually writes `Report.periodState` + legacy tuple. If it
      should and does not → fix code; if the spec is wrong → correct the spec.
      Record which.
      → RESOLVED: the SPEC was wrong, corrected in archived change
      `2026-06-03-fix-period-dual-state-writer-count`. `saveCarryOver`
      ($transaction) writes only child rows (`carryOverExecution`,
      `carryOverRecord`, `item`, `decision`) and never touches `Report` period
      fields — the target `Report` already carries both representations from
      `period-creator`. The spec's writer list was narrowed to the seven genuine
      `buildTransition` writers + snapshot-restore.

## Close out (per the agreed decision)

- [~] SC-13: With gates green, 0 console ERRORS per role, and diff-tagged `Then`s
  holding → archive `final-gates-resweep`, `verify-a11y-recommended-flip`,
  and `defer-uat-codequality-vercel-2026-05-26` (whole umbrella if Wave 1 is
  clean).
  → PARTIALLY ACTIONED 2026-06-08: `final-gates-resweep` archived this
  session (gates + automated sweep green). `verify-a11y` VA-0a/0b landing now;
  VA-1..VA-9 + `defer-uat` Wave 1 remain (live app / §4 user decision). Each
  change now owns its own archive — this umbrella checkbox is superseded by
  the per-change close-outs.
- [ ] SC-14: Leave `ratchet-lint-to-strict` R3/R4 and `defer-uat` Waves 3–4 as
      explicit backlog (net-new, out of scope).
- [ ] SC-15: `openspec validate establish-scenario-catalog --strict` green;
      archive this change.

## Parked reconciliation orphans (see findings/RECONCILIATION.md)

Items from past handoffs captured nowhere else — parked here so an OpenSpec-first
session sees them. Each notes its natural home change.

- [x] O1: Fix the stale `WorkingDays.{MON_SAT,MON_SUN}` schema comment ("v1 does
      not change deadline calc") — they DO alter `computeDeadline`. Home:
      `cleanup-dead-enum-states`.
      → FIXED 2026-06-08 directly in `prisma/schema.prisma` (home change was
      already archived). Verified the claim against code: both `computeDeadline`
      call sites (`period-creator.scheduler.ts`, `period-admin.service.ts`) pass
      `settings.workingDays`, and `workingDaySet` returns 5/6/7-day sets per
      policy — the enum genuinely drives deadline calc. Comment rewritten to say so.
- [x] O2: UI "products" are domain "projects" — admin UI references nonexistent
      `saveProduct`/`archiveProduct`; real procedures are
      `saveProject`/`deleteProject`. Reconcile naming. Home:
      `fix-admin-role-model-drift`.
      → RESOLVED: the admin UI already calls `trpc.admin.saveProject` /
      `trpc.admin.deleteProject` (`products-tab.tsx:88,101`); the naming was
      reconciled in archived `2026-06-03-fix-admin-role-model-drift`. No
      `saveProduct`/`archiveProduct` references remain.
- [x] O3: Record an Opus adversarial review of the DI import-type fix
      (commit 7952e3c5, 47 sites; gates were green, no review logged). Home:
      `ratchet-lint-to-strict`.
      → RE-HOMED 2026-06-08 to `ratchet-lint-to-strict` R6a (parking duty
      discharged; the review itself is tracked there, not yet executed).
- [x] O4: Audit remaining lazy/conditional `import type` paths for runtime DI
      type-lies (the biome-importtype-broke-nest-di pattern). Home:
      `ratchet-lint-to-strict`.
      → RE-HOMED 2026-06-08 to `ratchet-lint-to-strict` R6b.
- [x] O5: Delete the merged local branch `feat/openspec-lint-ratchet-a11y`
      (branch hygiene) — done this session.
- [x] O6: Verify coming-soon UI cards render correctly per role. Home:
      `verify-a11y-recommended-flip` / SC-9.
      → RE-HOMED 2026-06-08 to `verify-a11y-recommended-flip` VA-9 (live-app
      check, grouped with VA-1..VA-8).
