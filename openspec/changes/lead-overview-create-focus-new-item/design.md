# Design: focus the new item after an Overview create save

## Context

- Close path: `driveOverviewSubmission` (`overview-item-submission.ts:76`) sets the
  dialog to `null` once `overviewSubmissionIsAcknowledged` holds; for
  `addAnother` it reseeds the composer instead.
- On close, `useOverviewFocusReturn` (`use-overview-focus-return.ts:44`) focuses the
  opener by its `data-overview-focus` key. Several `+` controls of one unit can share
  a key prefix, and `focus()` scrolls the chosen control into view; in a long unit
  that lands on the next unit and leaves the new row above the viewport.
- `useOverviewMovedFocus` (`use-overview-moved-focus.ts:33`) already focuses an item's
  own control by identity after a direct move, falling back to the Overview heading.

## Decision

Flow: confirmed receipt → close target → one DOM focus after render.

1. Identity comes from the confirmed receipt, not from `dialog.stableId` (null for a
   plain create): extend the existing acknowledgement check
   (`findAcknowledgedItem` / `overviewSubmissionIsAcknowledged`,
   `overview-editor-recovery.ts:103–171`) to return the confirmed item (stableId and
   saved week), keeping the `overviewSubmittedItemIsCurrent` condition.
2. Success point: only the acknowledged create branch without `addAnother` in
   `driveOverviewSubmission` (`overview-item-submission.ts:128–146`); never
   `closeOverviewDialog` (cancel/restore) and never inside a `setDialog` updater.
3. One focus mechanism: hand the success target to the existing close handling
   (`useOverviewFocusReturn`) instead of adding a competing effect. Target = the
   visible control of that item in the saved week (Current or Next) within the same
   unit; never Previous and never a hidden responsive copy. Focus with
   `preventScroll: true`, then scroll the item itself into the scrollport. Fallback:
   visible opener → Overview heading.

Rejected: reusing `useOverviewMovedFocus` as is (prefers Next and any identity
suffix — could pick Previous or a hidden copy); changing opener key matching (still
lands on the opener); scrolling without moving focus.

Tests: Current and Next create, save error then retry, foreign/stale receipt, cancel
and discard unchanged, add-another unchanged, fallback order; browser: long product
at 1440 and narrow width.

## Risks

- Autosave echo re-renders: the identity lookup uses the acknowledged draft row, so a
  later echo does not change the target. Low risk.
- Fallback order differs from the spec if the moved-focus fallback skips the opener;
  the implementation must keep opener before heading (scenario "control unavailable").
