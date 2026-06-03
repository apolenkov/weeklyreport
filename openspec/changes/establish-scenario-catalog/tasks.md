# Tasks

Gates after every code step: `pnpm typecheck && pnpm lint && pnpm test`.

## Preconditions

- [x] SC-P1: Confirm clean working tree on `main`
      (`git status --short --branch`).
- [x] SC-P2: Confirm the catalog pilot `e2e/catalog/carry-over.feature` is the
      agreed reference format before any fan-out.
- [ ] SC-P3: Confirm Playwright MCP (or native `e2e/` harness) is reachable for
      the UI tier; if MCP is down, the UI tier uses native specs only.

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

- [ ] SC-6: Add a `catalog:check` command that re-derives the entry-point surface + entity enums and exits non-zero when code exposes surface absent from the
      catalog, naming the uncovered surface.
- [ ] SC-7: Wire `catalog:check` into CI as a gate.

## Diff-scoped verification run (consumes existing changes)

- [x] SC-8: Run the four-command gate chain
      `pnpm typecheck && pnpm lint && pnpm test && pnpm build`; confirm one green
      exit (executes `final-gates-resweep` gate tasks).
      → 2026-06-03 all green: typecheck ✓, lint 0 errors (2 non-gating warns),
      test 579/579 web + cached API ✓, build ✓ (5/5 tasks).
- [ ] SC-9: Consolidated per-role runtime sweep (Lead/Head/Admin/Viewer) via
      `/auth/dev-login?role=<ROLE>`, driven by the diff-scoped catalog + the
      a11y interaction checks from `verify-a11y-recommended-flip`; assert 0
      console ERRORS and that each diff-tagged `Then` holds. This single pass
      covers `final-gates-resweep` sweep + `verify-a11y` + `defer-uat` Wave 1.
- [ ] SC-10: Targeted manual pass on top-risk flows (the six period writers,
      publish/revoke, carry-over, periods-tab delete dialog).
- [ ] SC-11: Any failure → file a dedicated openspec change; do NOT patch under
      this change.

## Reconcile the live drift finding

- [ ] SC-12: Resolve `period-dual-state` ↔ carry-over: determine whether
      carry-over actually writes `Report.periodState` + legacy tuple. If it
      should and does not → fix code; if the spec is wrong → correct the spec.
      Record which.

## Close out (per the agreed decision)

- [ ] SC-13: With gates green, 0 console ERRORS per role, and diff-tagged `Then`s
      holding → archive `final-gates-resweep`, `verify-a11y-recommended-flip`,
      and `defer-uat-codequality-vercel-2026-05-26` (whole umbrella if Wave 1 is
      clean).
- [ ] SC-14: Leave `ratchet-lint-to-strict` R3/R4 and `defer-uat` Waves 3–4 as
      explicit backlog (net-new, out of scope).
- [ ] SC-15: `openspec validate establish-scenario-catalog --strict` green;
      archive this change.
