# Fix Lead Surface: Snapshot Triggers, Archive Toggle, Fill From, History Summary

## Why

Live user review of the lead report page (2026-06-10) surfaced six
findings; a 7-agent audit (`memos/lead-surface-audit-verdict.md`)
confirmed seven bugs with file:line root causes and three design gaps.
Worst offenders: leaving snapshot view reopens the Add Item modal (stale
add-signal + `readOnly` in an effect dep array), the Show-archived toggle
is a visible no-op when no archived periods exist, the History Summary
mixes draft and submitted populations, and the Fill From dropdown is
clipped by the toolbar's `overflow-x-auto` (the inner-wrapper un-clip
landed as `22790a3d`; the toolbar layer remains).

## What Changes

Confirmed bugs (all frontend-only, existing tokens, evidence in the memo):

1. Remove `readOnly` from the add-signal effect deps in
   `current-week-section.tsx:171` and `next-week-section.tsx:117`; reset
   the add-signal counters on entering snapshot mode (hardening).
2. Render the ArchiveToggle slot only when `hasArchivedPeriods`
   (`lead-form.tsx:1562-1572`).
3. Base History Summary risks / avg items / traffic-light totals on
   submitted entries only (`lead-history-sidebar.tsx`); keep Submissions
   as `submitted/total`; muted "draft not included" note.
4. Portal the Fill From dropdown to `document.body` (mirror the file's
   own confirmation-modal portal); defensively switch
   `report-toolbar.tsx:17` to `overflow-x-clip`.
5. Fill From: first-row highlight via classes so hover works (drop inline
   styles).
6. Fill From: hide the search input when there are no past periods.
7. Fill From: replace the hardcoded `#999` data-URI search icon with an
   inline SVG using `--color-muted-foreground`.
8. Consistency: pass archive-filtered periods to FillFromButton
   (`lead-form.tsx:1577`).

Approved design work (user sign-off 2026-06-10, recorded in the memo):

9. Product-card stripe: keep traffic-light color, render the stripe
   DASHED while any of the lead's own stages is unfilled (extends the
   dashed="not yet" idiom).
10. ArchiveToggle count badge ("N archived") + archived markers in the
    period combo so toggling is visibly effectful.
11. Fill From "Previous" badge → accent fill + white text (it currently
    melts into the row background).

**Non-goals:** no API/schema changes (`myHistory` stays unfiltered by
design); no head/viewer surfaces; no new color tokens.

## Capabilities

### New Capabilities

- `lead-report-controls-integrity`: durable honesty properties of lead
  report controls — state transitions never open dialogs, no-op controls
  are hidden, popovers escape clipping containers, summary aggregates use
  one population, incomplete own-stages render the dashed stripe.

### Modified Capabilities

<!-- none: status-color-semantics is respected, not changed -->

## Impact

- `apps/web/src/components/lead/`: `current-week-section.tsx`,
  `next-week-section.tsx`, `lead-form.tsx`, `lead-history-sidebar.tsx`,
  `fill-from-button.tsx`, `sdlc-pipeline.tsx`,
  `report-shell/archive-toggle.tsx`, `report-toolbar.tsx`,
  `period-navigator.tsx`.
- Status: CAPTURED 2026-06-10 (user chose "оформить, реализовать позже");
  implementation-ready — root causes and fix plans are in the memo.
