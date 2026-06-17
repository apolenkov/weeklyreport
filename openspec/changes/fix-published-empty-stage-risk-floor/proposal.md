# Proposal: fix-published-empty-stage-risk-floor

## Why

A product whose ONLY non-green signal is an EMPTY stage covered by the section
author's OWN at-risk/blocked risk shows GREEN in the published report, the head
view, and the PDF export. The risk is real and owned, but every published reader
reports the product as healthy. The head publishes a green product that is in
fact at-risk; the lead's own risk does not reach the head's eyes through the
product status colour.

The mechanism is a layered gap. `buildStageGrid`
(`apps/web/src/lib/mappers/lead-form.ts:383-390`) bakes the risk-severity floor
only into NON-EMPTY stages — the empty→empty guard (a W11 completeness rule)
preserves an empty stage's raw `status: null`. On the API read path,
`aggregateStageTraffic`
(`apps/api/src/modules/report-sections/report-sections.prisma-repository.ts:121-140`)
skips null stages, so an all-empty product yields `null` and `project.trafficLight`
falls back to the explicit `ProjectStatus` (green). The published rollups
(`apps/api/src/modules/published-report-snapshot.ts`,
`buildPortfolioProductsFromSnapshotSections` → `computeWorstStatus`) consume that
raw `trafficLight` and never fold `section.risks`.

The slide deck already floors this correctly via `floorSlideStageStatus`
(`status-risk-unification`). The published product-status path does not. The two
surfaces disagree: slides show red, published shows green.

This is a correctness gap in the existing `status-risk-unification` capability,
not new behaviour — that spec already declares risks the single source of truth
for at-risk/blocked. It states the head-form, preview, and PDF surfaces "reflect
the risk through the product-level `worstStatus`", but `worstStatus` is in fact
NOT risk-aware for an empty covered stage. This change closes that gap.

## What Changes

- **Published product status becomes risk-aware at the AGGREGATION/read layer.**
  The product-level traffic-light / `worstStatus` computation folds the section
  author's OWN covering risks, mirroring the canonical `riskCoversStage` +
  `deriveEffectiveStageStatus` severity precedence (blocked > at-risk), including
  the empty-`stageNames` = "covers all assigned stages" rule.
- **All published readers get the floor.** There are TWO product-status source
  shapes on the published path, and the fix must cover both:
  - the per-product `trafficLight` on `ReportSectionReadModel` — read by the
    head/weekly view (`buildPortfolioProductsFromSnapshotSections`), the
    read-model portfolio overview (`computePortfolioOverviewFromReadSections`),
    and the PDF export (`pdf-export.prisma-repository.ts`). Floored by the mapper
    fix below.
  - the raw `projectStatuses` shape — read by the published-snapshot portfolio
    totals (`computePortfolioOverviewFromProjectStatuses`, called by
    `buildAssembledReportFromPrismaRow`) and the PDF portfolio totals
    (`computePortfolioOverview` in `pdf-export.prisma-repository.ts`). NOT touched
    by the mapper fix — so without further change the per-product card reads red
    while the top-line totals still count the product green, inside the SAME
    snapshot and the SAME PDF. The fix MUST also re-route or risk-fold these two
    totals so they agree with the floored product status.
- **The raw persisted stage status column is NOT mutated.** The empty→empty guard,
  the X/7 own-input completeness counter, and the `coveredByOwnRisk` distinction
  all keep their current raw-empty semantics. The floor is applied at read time on
  the way to the product-level status, not written back to the stage.
- **A missing API regression test is added FIRST** — a section with one owned
  stage `status: null` plus one own blocked/at-risk risk (a stage-named variant
  and a covers-all empty-`stageNames` variant) must produce a red/yellow
  `worstStatus`, not the green fallback.
- **The slide deck is not touched** — `floorSlideStageStatus` already floors
  correctly. Scope note only.

## Capabilities

- `status-risk-unification` (modified) — adds the published-surface risk floor at
  aggregation time, so the product-level `worstStatus` honoured by all published
  readers reflects an empty stage covered by an own risk.

## Impact

### Backend / API (the fix lives here)

- `apps/api/src/modules/report-sections/report-sections.prisma-repository.ts` —
  the product `trafficLight` derivation folds `section.risks` for the section
  author's own covering risks, mirroring `riskCoversStage` (incl. empty
  `stageNames` = covers-all) + `deriveEffectiveStageStatus` precedence, without
  mutating the raw per-stage `status`. The canonical precedence helper is mirrored
  on the API side (the existing `riskCoversStage` / `deriveEffectiveStageStatus`
  live under `apps/web/**` and cannot be imported across the app boundary; either
  re-state the small precedence rule in the API module or lift a shared helper
  into `packages/shared`).
- `apps/api/src/modules/published-report-snapshot.ts` — the `trafficLight`-based
  rollups (`buildPortfolioProductsFromSnapshotSections`, `computeWorstStatus`,
  `computePortfolioOverviewFromReadSections`) inherit the floor once the mapper is
  risk-aware. BUT `buildAssembledReportFromPrismaRow` computes its
  `portfolioOverview` via `computePortfolioOverviewFromProjectStatuses` (raw
  `projectStatuses`, line 46) — that path is NOT floored by the mapper fix and
  must be re-routed onto the read-model/`trafficLight` shape (or risk-folded) so
  the published top-line totals match the floored product cards.
- `apps/api/src/modules/pdf-export/pdf-export.prisma-repository.ts` and
  `apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts` — verified
  consumers of the same `mapPrismaToReportSection` read model; both inherit the
  product-card fix once `trafficLight` is risk-aware. The PDF's own
  `computePortfolioOverview` (line 135) reads raw `projectStatuses` and needs the
  same totals re-route as the published snapshot above.

### Side effect — escalations are a `trafficLight` reader

- `buildEscalationsFromReadSections` emits an `at_risk` "Project X is flagged red"
  escalation for every `project.trafficLight === "red"`. Once the floor turns the
  bug case red, this fires a NEW escalation alongside the existing per-risk
  `unresolved_risk` one. The product IS red, so the double-surfacing is acceptable,
  but it MUST be pinned by a test expectation rather than left implicit.

### Tests

- `apps/api/src/modules/published-report-snapshot.test.ts` — add the missing
  product-status-from-own-risk regression (currently only escalations are
  covered). Feed `buildPortfolioProductsFromSnapshotSections` a section with an
  empty owned stage + an own covering risk and assert `worstStatus` is red/yellow.
- `apps/api/src/modules/report-sections/report-sections.integration.test.ts` —
  it already creates a blocked risk but never asserts product `trafficLight`; add
  that assertion so the live path is pinned too.

### Out of scope

- The lead live form, the read-model raw stage status, the X/7 completeness
  counter, and the slide deck (`floorSlideStageStatus`) — all already correct; not
  touched.
- The archive **legacy fallback** total (`computePortfolioOverview` /
  `toArchiveSummary` in `archive.prisma-repository.ts`) — only reached when a
  published report has NO stored `publishedSnapshot`. Real published reports
  always carry a floored snapshot (`toArchiveSummaryFromSnapshot` wins), so this
  path is effectively dead. It also counts raw `ProjectStatus` rows on a
  DIFFERENT basis than the assignment-scoped read model, so re-routing it would
  change which products are counted, not just add the floor — out of scope here.
  Left raw with a code comment; tracked as a follow-up if it ever becomes
  reachable for real data.
