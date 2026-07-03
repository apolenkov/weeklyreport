# Tasks — lead-report-surface-polish

> **STATUS 2026-07-04.** §1–§4 (the settled presentation cluster: slide
> product-grouping, uniform item cards, +Add placement, single reopen surface)
> were implemented 2026-07-03 in commit `2e5fb45e`
> ("feat(lead): implement lead-report-surface-polish §1-4") — verified in-tree
> (`lead-unified-slide.tsx` `showHeadings`/`productHeading`, `item-card.tsx`
> fixed reference height + `line-clamp-3`, `lead-form.tsx` QuickAddButton before
> Submit outside the `!isSlidesMode` gate, `alert-bar.tsx` reopen indicator
> removed). The openspec change was left at 0/24; these boxes now reflect
> reality. §5 (carry-over automation) and §6 (review-acknowledge placement) are
> **PARKED** — each carries an unresolved design open question (§5.1 trigger
> point, §5.3 unused `carryOver.uncarried` read, §6.1 non-publisher acknowledge
> path) that is a product-owner decision, and §5 is backend + integration (not
> web-only). Do NOT build §5/§6 until those questions are answered. §7.5
> live-verify (visual) is PENDING Sasha's walkthrough.

## 1. Lead slides — group by product, author, hierarchy, overflow (A1, A2, A4)

- [x] 1.1 In `apps/web/src/components/slides/lead-unified-slide.tsx`, replace the
      per-row `productBadge` with one neutral product heading per product block
      inside each quadrant (muted, truncated, `title` = full name; no status
      color); render the `cross-product` block under a single "Shared context"
      heading; single-product slides render flat with no heading. Drive the
      grouping off the per-product buckets already produced by
      `buildUnifiedSlideModel` (`section-slide-utils.ts`); rename/replace the
      `showBadges` (`countRealProducts > 1`) gate as the `showHeadings` gate.
- [x] 1.2 Preserve the overflow contract under grouping: every row still renders
      (no "+N more"), the quadrant scrolls internally (`overflow-y:auto` +
      `min-h-0`), and product-count overflow keeps paginating via
      `paginateSectionSlides`. No change to `--slide-quadrant-min` or the carousel.
- [x] 1.3 Keep the author identity on the slide (the `LeadSlideHero` owner name in
      `status-slide-deck.tsx`); confirm ranked records still float above unranked
      within each product group (`sortByPriorityRank`) after grouping.
- [x] 1.4 Update `lead-unified-slide.test.tsx` (and any snapshot) for headings vs
      badges; assert single-product flat, multi-product headings, Shared-context
      grouping, and no "+N more".

## 2. Lead item cards — uniform height + ellipsis/tooltip (B1, B2)

- [x] 2.1 In `apps/web/src/components/lead/item-card.tsx`, replace the
      `min-height: 110` growing-column layout with a fixed reference height (the
      empty-state placeholder card) shared by populated and empty cards; the body
      text region absorbs the slack and the fixed chrome (status pill, author,
      stage tags) is never clipped.
- [x] 2.2 Pin the static-render truncation: keep `line-clamp-3` + `title` (full
      text on hover); ensure the inline edit textarea still shows/accepts the full
      untruncated text.
- [x] 2.3 Update `item-card.test.tsx` (and any accordion-section test) to assert a
      short and a long card share the empty-state reference height, and that the
      edit textarea shows full text.

## 3. Lead "+ Add" — reposition + keep in slides (C1, C2)

- [x] 3.1 In `apps/web/src/components/lead/lead-form.tsx`, move the
      `<QuickAddButton>` to sit immediately before the Submit Section commit in
      `DocumentActionGroup` (after Save and Fill-From) and drop the `!isSlidesMode`
      guard so it renders in edit AND slides; keep the `!isReadOnly` gate and the
      `products.length === 0` disable.
- [x] 3.2 Confirm the accent hierarchy: "+ Add" stays neutral/outline
      (`quick-add-button.tsx`), Submit Section keeps the single resting brand
      accent (`report-toolbar-layout`).
- [x] 3.3 Update `quick-add-button.test.tsx` and the lead-form test(s) to assert
      slides-mode visibility and the order relative to Submit.

## 4. Head dashboard — one reopen surface (HF6)

- [x] 4.1 In `apps/web/src/components/dashboard/alert-bar.tsx`, remove the reopen
      indicator, the `pendingReopenCount` query, and the
      `REOPEN_REQUESTS_CARD_ID` anchor; restore the self-suppress to
      `pendingLeads.length === 0`. `ReopenRequestsCard` stays the single reopen
      surface (its header count + queue).
- [x] 4.2 Update `alert-bar.test.tsx` + its snapshot and `dashboard-page.test.tsx`
      for the alert bar without the reopen line and the card as the only reopen
      surface.

## 5. Carry-over automation + banner removal (HF10) — PARKED (open questions)

- [ ] 5.1 CONFIRM the trigger point (design Open Question 1) before coding:
      per-lead at `ensureLeadSection` (primary) vs eager materialization at
      `createPeriodManual` (alternative).
- [ ] 5.2 Add the automatic trigger reusing `CarryOverService.executeCarryOver`
      copy rules; scope to the just-established author's section (per-author entry
      point if primary trigger chosen). Preserve the write-integrity guard
      (editable target, never overwrite `submitted`) and idempotency (the
      `@@unique([reportSectionId, stableId])` lineage skip + execution dedupe).
      NO schema change.
- [ ] 5.3 Remove `apps/web/src/components/weekly-report/carry-over-banner.tsx` and
      its mount in `weekly-report-page.tsx`; delete `carry-over-banner.test.tsx`.
      Decide the fate of the now-unused `carryOver.uncarried` read (design Open
      Question 4).
- [ ] 5.4 Add/adjust service + integration coverage: unfinished carried
      automatically, no prior period → no-op, finished work not carried, second
      provisioning does not duplicate, submitted/non-editable target rejected.

## 6. Review-acknowledge placement (HF1) — PARKED (open question)

- [ ] 6.1 In `weekly-report-page.tsx`, relocate `AcknowledgeSurface` /
      `ReviewAcknowledgeBar` for head/admin into the Publish & Lock action cluster
      on the header line; do NOT gate publish on acknowledgement. Resolve the
      non-publisher acknowledge path (design Open Question 2) before finalizing.
- [ ] 6.2 Keep the acknowledge mutation, per-group model, and "Seen by" roster
      unchanged; update `review-acknowledge-bar.test.tsx` and the page test for the
      new placement.

## 7. Verification

- [x] 7.1 `pnpm --filter @customreport/api db:generate` then `pnpm typecheck` green.
- [x] 7.2 `pnpm lint` green (eslint `--max-warnings 0` + stylelint + prisma
      typecheck); no `grep -nE '[а-яА-Я]'` hits in changed `apps/web/src/**/*.tsx`
      except data/comment/test.
- [x] 7.3 `pnpm test` (unit) green, including the updated slide/card/quick-add,
      alert-bar (+ snapshot) tests. (Carry-over/acknowledge tests deferred with §5/§6.)
- [ ] 7.4 (PARKED with §5) Carry-over integration coverage green for the
      automatic-trigger behavior.
- [ ] 7.5 (PENDING Sasha's walkthrough) Live-verify from source: lead slides group
      by product with the author shown and no "+N more"; item cards uniform with
      hover tooltip; "+ Add" visible in slides, before Submit; dashboard shows one
      reopen surface.
- [ ] 7.6 `openspec validate lead-report-surface-polish --strict` clean.
