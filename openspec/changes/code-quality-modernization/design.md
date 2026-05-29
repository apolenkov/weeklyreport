# Design: behavior-preserving structural refactors

## Context

The code-quality inventory found a clean codebase with a few oversized modules.
The constraint that dominates every decision here is the CLAUDE.md HOT ZONE
rule: product / group / report-period / query-semantics code is regression-heavy
and has burned past UAT cycles. So the central tension is "improve structure"
versus "do not move behavior." Two further constraints: this is planning only
(implementation lands later on the Biome-first integration branch), and the
change must not touch DB, Prisma migrations, public contracts, or UI strings.

## Decision

Each refactor is behavior-preserving and is sequenced by risk, lowest first, so
the riskiest move runs against a codebase already re-stabilized by the cheaper
moves.

1. **shared schema split is pure re-export.** Splitting `report.ts` into
   domain files behind a barrel changes file layout only. No symbol is renamed
   — including the legacy-misnamed `stageIds` — so every importer is untouched
   and the existing 1,816-LOC test suite is the regression guard.

2. **admin decomposition keeps the public surface.** The four extracted
   services (`PeriodAdminService`, `ReminderAdminService`, `ProjectAdminService`,
   `SnapshotAdminService`) are wired in `admin.module.ts`; tRPC procedures and
   method signatures stay identical. `admin.integration.test.ts` is the guard.
   Admin is not HOT ZONE and is low-interactivity, so no new characterization
   test is mandated (existing integration coverage suffices).

3. **report-sections extraction is gated by a NEW characterization test
   (HOT ZONE).** This is the only place the HOT ZONE rule bites. Per CLAUDE.md
   and the locked grill decisions, a structural refactor here is allowed ONLY
   with existing green tests PLUS a new characterization test. The
   characterization test is written and proven green BEFORE the extraction, then
   re-run after, so it certifies the move preserved behavior rather than merely
   re-asserting the new shape.

## ADR: when does a refactor in this change require a new characterization test?

- **Status:** Accepted (2026-05-29, this change).
- **Decision:** A structural refactor in this change MUST add a new
  characterization test if and only if it touches HOT ZONE code — product,
  group, report-period, or query-semantics paths (CLAUDE.md). Non-HOT-ZONE
  refactors (admin services, shared schema layout, web hooks) rely on the
  existing green test suites as their regression guard and MUST NOT change
  behavior.
- **Why:** The HOT ZONE has a documented regression history; existing tests
  encode known-good behavior but were not written to survive a structural move.
  A characterization test, green against the pre-refactor code, is the only
  artifact that proves the move was behavior-preserving. Outside the HOT ZONE the
  marginal regression risk does not justify net-new test surface, and demanding
  it everywhere would dilute the signal of the HOT ZONE gate.
- **Consequence:** `report-sections` extraction carries
  `version-snapshot.characterization.integration.test.ts`; the admin, shared,
  and web tasks do not add characterization tests.

## Alternatives considered

- **Do the whole thing on the Biome branch.** Rejected — coupling a large
  behavioral refactor with a toolchain migration makes any regression
  ambiguous (refactor or formatter?). Sequencing after Biome lands keeps the
  two diffs separable.
- **Rename `stageIds` while splitting the schema.** Rejected — a rename is a
  behavior-visible churn across many importers and is explicitly out of the
  behavior-preserving scope; the misnaming is documented, not a debt this change
  pays.
- **Require a characterization test for every refactor.** Rejected per the ADR
  — it would add low-value test surface outside the HOT ZONE and weaken the gate
  where it matters.
- **Route admin snapshot logic through the period transition module.**
  Rejected — out of scope; snapshot restore is a separate, already-specced
  concern (`fix-snapshot-lifecycle-restore`). This change only relocates the
  existing snapshot code into `SnapshotAdminService`, verbatim.
