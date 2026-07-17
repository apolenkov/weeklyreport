## 1. Canonical queue model

- [x] 1.1 Confirm `sweep15-dashboard-draft-drilldown` is landed or composed, then inventory every lead identity/state/freshness/count/action field from `LeadSummaryTable`, `ActivityLivePanel`, and `SectionReviewStrip`; map each unique signal to the new queue or a deliberate non-roster event feed.
- [x] 1.2 Add a pure combined per-lead queue model that joins weekly, review, and activity data without duplicating leads.
- [x] 1.3 Implement and test action-priority ordering (requested changes/reviewable, stale open work, active drafts, completed) with stable name ties.
- [x] 1.4 Add model fixtures for missing sections, content-bearing drafts, submitted/reviewable sections, verdict history, stale timestamps, activities, and published periods.

## 2. Period Summary redesign

- [x] 2.1 Replace the current count-rail card with a compact expandable queue row containing identity, role, state/verdict, freshness, attention/content summary, and primary contextual action.
- [x] 2.2 Build accessible expanded detail for product/activity counts, edit/submission freshness, review summary, and secondary actions with `aria-expanded`/`aria-controls` and stable focus.
- [x] 2.3 Wire Open for all content-bearing rows (including drafts) to the existing report destination and Review to the existing review-capable report surface.
- [x] 2.4 Wire Remind, Request Changes, and Revoke through existing components/mutations and capability gates; refetch/invalidate the combined queue sources after mutation.
- [x] 2.5 Add responsive layouts with no horizontal scroll or clipped controls at desktop, tablet, and phone widths.

## 3. Remove duplicate rosters and rebalance actions

- [x] 3.1 Remove the standalone Section Review roster after verdict/action parity is proven in queue rows.
- [x] 3.2 Remove the Submission Activity lead roster; if non-lead operational events remain, render them only as a collapsed non-roster feed.
- [x] 3.3 Keep KPI cards, non-roster aggregate AlertBar content, Reopen Requests, and Blocked & At Risk with their existing behavior.
- [x] 3.4 Move Revoke All from the page-header primary slot to a secondary bulk/destructive area while preserving count, confirmation, authorization, and mutation behavior.

## 4. Verification and catalog

- [x] 4.1 Run focused queue model/row/action tests covering each state and mutation transition.
- [x] 4.2 Update dashboard catalog scenarios for queue collapsed/expanded, content-bearing draft Open, Remind, Review, Request Changes, Revoke, published read-only, and secondary Revoke All.
- [x] 4.3 Drive the head dashboard from source and confirm each lead appears once, actions match state, and no unique activity/review signal was lost.
- [x] 4.4 Check changed `.tsx` files with `grep -nE '[а-яА-Я]' <file>` and confirm every hit is permitted data/comment/test content.

## 5. Repository gates

- [x] 5.1 `pnpm --filter @customreport/api db:generate`
- [x] 5.2 `pnpm typecheck`
- [x] 5.3 `pnpm lint`
- [x] 5.4 `pnpm test`

## 6. Adversarial review closure

- [x] 6.1 Build the canonical roster from the union of weekly sections, review rows, and activity rows with one row per lead and source precedence preserved.
- [x] 6.2 Resolve activity through the shared leadership report target so a published fallback still enumerates scoped leads without sections.
- [x] 6.3 Prove the published queue contains both section-backed and no-section leads and keeps every unavailable action read-only.
- [x] 6.4 Split queue row, detail, action, and summary components so every touched production function remains at or below 50 lines.
