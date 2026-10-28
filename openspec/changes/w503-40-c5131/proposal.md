# Proposal: Accessible Draft-Hidden Signal in Report Review

## Why

Screen-reader and assistive-technology (AT) users reviewing reports do not receive notifications when draft sections are hidden by the default Submitted filter, nor do they hear changes when switching filters or activating "Show all", because the `DraftHiddenSignal` banner lacks live-region semantics (`role="status"`, `aria-live="polite"`). Furthermore, the "Show all" action button within the notice lacks descriptive AT context, leaving users unsure of which content will be shown.

This change fixes finding C5131 from task 503.40 by adding live region semantics to the draft-hidden signal and providing clear AT context to the action button without introducing redundant announcements.

## What Changes

- Add `role="status"` and `aria-live="polite"` to `DraftHiddenSignal` in `apps/web/src/features/review/ui/submission-filter.tsx`.
- Disambiguate the "Show all" action button for AT users by adding an accessible name/label (`aria-label="Show all sections including drafts"`).
- Update the owning specification (`head-report-visibility`) to require accessibility semantics for the draft-hidden notification banner.

## Non-goals

- Changing toggle buttons in `SubmissionFilterToggle` to radiogroup (C5130, deferred / separate issue).
- Modifying pagination controls or auto-focus behavior (C5099).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `head-report-visibility`: The draft-hidden signal MUST be accessible to assistive technologies via a polite live region (`role="status"`, `aria-live="polite"`) and provide clear action context for the "Show all" control.

## Impact

- `apps/web/src/features/review/ui/submission-filter.tsx`: Updated `DraftHiddenSignal` container and button attributes.
- `apps/web/src/features/review/ui/submission-filter.test.tsx`: Tests verifying live region role, aria-live attributes, and button accessible name.
