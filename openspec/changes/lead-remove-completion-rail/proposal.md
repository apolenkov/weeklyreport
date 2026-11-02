## Why

The owner reviewed the Lead Report on the stand (2026-11-02) and asked to remove
the bottom completion rail: a wide card with a single Submit button permanently
takes a strip of the viewport and covers report content ("подвал надо убрать",
"неудобно"). Submit is a once-a-week action; the header already carries it.

## What Changes

- Remove the Lead completion rail that replaced the header actions once they
  scrolled out of view. Completion actions (Submit, `n to review`, Retry saving
  draft) render only in the page header action group.
- The context toolbar still MUST NOT become a second document-action surface, so
  Submit does not move into the sticky period bar.
- The end-of-content submission explanation stays in normal flow, unchanged.

## Capabilities

### Modified Capabilities

- `report-toolbar-layout`: no header/rail hand-off.
- `lead-completion-guidance`: the rail requirement is replaced; the layout keeps
  only the content scrollport.
- `lead-status-overview-actions`: the sticky Retry requirement goes with the rail.
- `lead-plan-verdict`: the pending count is shown in the header only.

## Impact

`apps/web/src/features/report-pages/ui/lead/` completion presentation, header
actions and layout; the header-visibility observer and sticky actions component
are deleted.
