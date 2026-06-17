# Tasks: fix-published-empty-stage-risk-floor

## 1. Test first (the missing regression)

The bug case is an **owned stage with no submitted status** (`StageStatus.status = null`)
covered by the section author's **own risk**. Every test below uses that shape.
Unowned (unassigned) stages are out of scope here.

- [x] 1.1 In `apps/api/src/modules/published-report-snapshot.test.ts`, add a
      `buildPortfolioProductsFromSnapshotSections` case: one section, one owned
      product with one stage `status: null`, one own **blocked** risk whose
      `stageNames` is empty (covers-all). Assert `worstStatus === "red"`. Today it
      returns the green fallback — the test MUST fail before the fix.
- [x] 1.2 Add a covers-all **at-risk** variant: own at-risk risk whose `stageNames`
      is empty (covers-all) on an owned stage with `status: null`. Assert
      `worstStatus === "yellow"`. (Pins the AT-RISK covers-all floor, not just
      BLOCKED.)
- [x] 1.3 Add a stage-named variant: own at-risk risk whose `stageNames` names the
      one owned stage with `status: null`. Assert `worstStatus === "yellow"`.
- [x] 1.4 Add a guard case: stage already red + a milder own at-risk risk →
      `worstStatus` stays red (floor never lowers).
- [x] 1.5 Add a cross-product isolation case: two products in one section, a
      covers-all (empty `stageNames`) own blocked risk on Product A only. Assert
      Product A `worstStatus` is red AND Product B stays green — the risk must NOT
      floor Product B's same-named stages. (This pins the `projectId`-first scoping
      from task 2.2; without it the covers-all risk would floor every product.)
- [x] 1.6 Run the new tests and confirm they FAIL against current code (prove the
      bug and the test's teeth before fixing).

## 2. Fix at the aggregation/read layer

- [x] 2.1 Decide the helper home (design D5): either re-state the precedence rule
      (blocked > at-risk, empty `stageNames` = covers-all) inside the API module,
      or lift a shared helper into `packages/shared` and reuse it on both surfaces.
      Confirm any lifted helper carries no `apps/web` React import.
- [x] 2.2 In `report-sections.prisma-repository.ts`, derive the product-level
      effective status by folding the section author's own covering risks:
      effective per-stage status = worse of raw stage status and highest covering
      own-risk severity; **derived effective product status** (`effectiveWorstStatus`)
      = worst across owned stages. Use the `riskCoversStage` covers-all rule for
      empty `stageNames`. This is an aggregation-only computation at the read layer
      — the result is never written back to any database column. SCOPE THE RISKS TO
      THE PRODUCT FIRST: for product P fold only `row.risks` where
      `risk.projectId === P.id`, then apply the per-stage match — `riskCoversStage`
      matches stage NAME only and the 7 stage names are shared across products, so
      an unscoped fold would floor the wrong product (and a covers-all risk every
      product). Mirror the existing `buildStageGrid` call site
      (`lead-form.ts:438-445`), which pre-filters by `projectId`.
- [x] 2.3 Do NOT mutate the raw persisted `StageStatus.status` column or the
      read-model per-stage `status` field; the `effectiveWorstStatus` is computed
      on read and replaces the `trafficLight` exposed to published readers. Keep
      the empty→empty guard, the X/7 counter, and `coveredByOwnRisk` intact.

## 3. Cover BOTH product-status source shapes (blind-spot #7)

- [x] 3.1 Shape A — confirm the head/weekly view picks up the floor:
      `buildPortfolioProductsFromSnapshotSections` → `computeWorstStatus` reads the
      now risk-aware `trafficLight`.
- [x] 3.2 Shape A — confirm the PDF export product mapping inherits it:
      `pdf-export.prisma-repository.ts` maps via the same
      `mapPrismaToReportSection`. Add or extend a test that the PDF
      assembled-report product status reads red for the bug case.
- [x] 3.3 Shape B — the published top-line portfolio totals are computed from raw
      `projectStatuses`, NOT from `trafficLight`, so the mapper fix does NOT reach
      them. `buildAssembledReportFromPrismaRow` (line 46) uses
      `computePortfolioOverviewFromProjectStatuses`, and PDF `toAssembledReport`
      (line 162) uses `computePortfolioOverview` (line 135). Re-route both onto the
      floored `trafficLight` (count `project.trafficLight` per product, as
      `computePortfolioOverviewFromReadSections` already does), so the per-product
      card and the top-line totals agree inside the same snapshot and PDF.
- [x] 3.4 Add regressions for both covers-all shapes: - `buildAssembledReportFromPrismaRow` with an owned stage with `status: null`
      covered by a covers-all own **blocked** risk: `portfolioOverview.status ===
  "red"` and the product counted red, not green. - Same setup with a covers-all own **at-risk** risk: product counted yellow.
      Assert the same for the PDF `toAssembledReport` path in both cases.
- [x] 3.5 Escalations — `buildEscalationsFromReadSections` emits an `at_risk`
      escalation per red `trafficLight`. Pin the expected escalations on the bug
      case (the new `at_risk` plus the existing `unresolved_risk`) so the
      behaviour change is deliberate.

## 4. Live-path regression pin

- [ ] 4.1 In `report-sections.integration.test.ts`, the existing blocked-risk case
      currently creates a risk but never asserts product `trafficLight`. Add the
      assertion: the derived effective product status reflects the own covering risk
      on an owned stage with no submitted status (raw `StageStatus.status = null`).

## 5. Gate

- [ ] 5.1 `npx prisma generate && pnpm typecheck && pnpm lint && pnpm test &&
pnpm build` — all green.
- [ ] 5.2 `pnpm --filter @customreport/api test:integration` — green (the
      integration suite is excluded from `pnpm test`).
- [ ] 5.3 Live-verify on a seed where an own covering risk floors an owned stage
      with no submitted status: the head view, the portfolio, and the PDF export all
      read red (blocked) or yellow (at-risk) matching the risk severity, and the
      slide deck (already floored) agrees with the published status.

## 6. Follow-up (post-merge)

- [ ] 6.1 After the PR merges to main, archive via `opsx:archive`.

## Scope notes

- The slide deck (`floorSlideStageStatus`) already floors correctly — do not
  touch it.
- The lead live form, the raw read-model stage status, and the X/7 completeness
  counter are correct as-is — do not change their raw-empty semantics.
