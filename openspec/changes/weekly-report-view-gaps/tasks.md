## 1. Fix the authorId deep-link scroll target

- [ ] 1.1 Locate the exact `scrollTargetProductId` derivation (likely
      `weekly-report-page-helpers.ts`) and confirm it currently reads
      `authoredProductIds[0]` with no content filter
- [ ] 1.2 Change it to derive from `focusedProductId` (the same
      content-filtered value used for accordion highlight), so scroll target
      and highlight always agree
- [ ] 1.3 Confirm no other consumer of `scrollTargetProductId` relied on the
      unfiltered first-authored-product behavior

## 2. Surface activity-only drafts in the draft count

- [ ] 2.1 Locate `draftCount`'s derivation via `mapWeeklyReportLeadGroups` in
      `weekly-report-page-helpers.ts`
- [ ] 2.2 Extend the count to include sections with draft activity content
      and no draft product content — mirror the existing `hasAnyContent`
      check's product-OR-activity logic
- [ ] 2.3 Confirm `mapWeeklyReportLeadGroups`'s other call sites (if any)
      still get product-only counting; add a separate inclusive derivation
      or an explicit flag rather than silently changing its return contract
      for every caller

## 3. Memoize the mapper chain against pure UI toggles

- [ ] 3.1 `weekly-report-page-view.ts` / `use-weekly-report-page.ts`: wrap
      the full mapper-chain call in `useMemo`
- [ ] 3.2 Key the memo on `reportData`, `scope`, `currentRole`,
      `currentUserId`, `focusedAuthorId`, `submissionFilter` — the
      data-dependent inputs — explicitly excluding `reviewMode` and other
      pure-UI-only props
- [ ] 3.3 Confirm a `reviewMode`-only re-render does not recompute the memo
      (reference-equality check in a test, not just visual inspection)

## 4. Tests

- [ ] 4.1 Unit test: first authored product empty, second has content —
      assert `scrollTargetProductId === focusedProductId`
- [ ] 4.2 Unit test: section with activity-only draft content, no draft
      product content — assert it is included in `draftCount` and the "Show
      all" affordance's trigger condition
- [ ] 4.3 Unit test: two renders with identical data-dependent inputs and a
      changed `reviewMode` — assert the memoized derivation's object
      reference is stable

## 5. Spec delta

- [ ] 5.1 `report-routing`: ADD a requirement that the `authorId` deep-link
      scroll target and the highlighted accordion panel always resolve to
      the same product
- [ ] 5.2 `report-routing` (or a more specific existing spec found during
      implementation): ADD a requirement that activity-only draft content is
      included in the draft-hidden count/affordance under the default
      submitted-only filter

## 6. Gates and verification

- [ ] 6.1 `pnpm --filter @customreport/api db:generate`
- [ ] 6.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 6.3 Manual/Playwright drive: open a weekly report via `?authorId=<id>`
      where the first authored product is empty; confirm scroll and
      highlight land on the same panel. Open a report with an
      activity-only draft section; confirm the "Show all" affordance
      surfaces it under the default filter.
- [ ] 6.4 `openspec validate weekly-report-view-gaps --strict`
