## Why

The head dashboard makes submitted rows with content clickable but leaves draft rows with the same report content inert, blocking the pre-deadline review workflow. P1-6 in `docs/reviews/2026-07-15-external-sweep.md` identifies the branch in `activity-live-panel.tsx`.

## What Changes

- Render every content-bearing `ActivityLivePanel` lead row as a link to `/head/report/[reportId]?authorId=[leadId]`, regardless of draft or submitted status.
- Preserve the draft status label and explanatory copy while giving the row the same keyboard, focus, and hover affordance as other linked rows.
- Keep only rows with zero content inert.
- Replace tests that assert an inert draft `<div>` with link-target, accessible-name, and truly-empty-row regression coverage.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `head-dashboard-clarity`: content-bearing live activity rows always drill into the focused live report; only empty rows are inert.

## Impact

- Web: dashboard live-activity panel and focused-report navigation tests.
- No API, permissions, report visibility, or lifecycle changes.

## Non-goals

- Linking empty/not-started rows.
- Changing the focused report URL contract or adding an edit action.
- Altering submission status or dashboard counts.
