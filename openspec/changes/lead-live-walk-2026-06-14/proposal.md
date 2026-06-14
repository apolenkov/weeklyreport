# Lead Live-Walk Feedback (2026-06-14 morning)

## Why

Live-walk (Agentation) over lead report, slides, head dashboard, and reports
history, AFTER PR #10. Captures the morning's annotations with exact anchors.
Mixed: two are suspected DATA/regression issues (triage before coding), the rest
are presentation/behavior fixes.

## Items

### 1. Risk dialog — back to TWO columns (reverses the single-column ship)

`lead/risk-edit-dialog.tsx`. PR #10 made it single-column `max-w-2xl`; live it is
too TALL (~885px, near `max-h-92vh`). User wants two columns again, but with a
JUSTIFIED layout: no stray empty space, elements perpendicular/parallel, aligned
columns of comparable height. Use the frontend-design skill. Keep all
fields/validation/behavior.

### 2. Slides product card — show risks/decisions + equal-height cells

`slides/lead-product-grid.tsx`.

- (a) "These things should be shown in slide mode too" — the risks/decisions are
  shown only as COUNTS in a footer (and only when > 0). Surface the actual
  risk/decision content on the slide card (like the form), not just a count.
- (b) Product cells should share ONE uniform height across the grid row
  (currently each card sizes to its content). Equal-height cards.

### 3. SUSPECT — statuses wrong + dashboard "not started though I started" (TRIAGE)

- Slides: "I think the statuses are now wrong" (after rethink-pipeline changed
  status derivation — held, not archived).
- Head dashboard (`dashboard/activity-live-panel.tsx` StatusPill/ActivityRow):
  Василий И. shows "No content · 0 items · 0 risks · 0 decisions · not started",
  but the user says he DID start.
- HYPOTHESIS A (likely): dirty dev seed — last night's report flagged residual
  REVIEW-TEST risk + CRM-Data-Lake corruption under Василий И. from overnight
  live tests. A clean reseed may make both correct.
- HYPOTHESIS B: rethink-pipeline regressed status/completeness derivation.
- ACTION: reseed dev DB, re-check both surfaces. Only if it persists on a clean
  seed is it a real bug → then fix in rethink before its archive. Do NOT mass-edit
  status code on a polluted DB.

### 4. Reports history — default no-archive, URL stable, nav active-state independent

`app/(app)/reports/page.tsx` (HistoryArchiveToggle) + `navigation/nav-bar.tsx`
(History link).

- History MUST default to showing WITHOUT archive.
- Toggling the archive switch MUST NOT change the URL.
- The nav "History" button's active/selected state MUST be independent of the
  archive toggle — toggling archive must not make History look un-selected.

### 5. Head report toolbar — make it 1:1 with the lead (rework of unify round-1)

`head/head-report-shell.tsx` + `report-shell/report-toolbar.tsx` +
`report-shell/agent-review-coming-soon.tsx`. PR #10's unify "did not get what I
wanted." Concrete asks:

- The whole head action line (Product/Leads · Edit/Slides · Present · Print ·
  Agent review) must be styled ONE-TO-ONE with the lead — identical heights,
  radii, spacing, control idiom. No head-specific divergence.
- `AgentReviewComingSoon` must be EXACTLY the same height as the other controls
  (it currently renders shorter, ~26px vs the touch-target height).
- Move Export-PDF and Publish INTO the toolbar pill, alongside Present and Print
  (today they live in the WeeklyReportPage header row). One consolidated bar.
- Net goal: the head report toolbar reads pixel-for-pixel like the lead's.

## Out of Scope

- Theme / token / dark-mode work.

## Notes

- Items 1, 2, 4 are actionable now. Item 3 is TRIAGE-FIRST (reseed). This change
  is the morning live-walk capture; treat the list as it stands.
