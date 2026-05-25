# Fix multi-tab lead-form sync

## Problem

When a lead edits a report section in one browser tab and switches to another
tab showing the same report, the edits do not appear until the tab is reloaded.
The multi-tab sync bridge exists but does not trigger `invalidateLeadForm`
across tabs.

Two locations need wiring:

1. `apps/web/src/components/lead/lead-form.tsx:329` — TODO(v8.5-D-multitab)
   marker notes "cross-tab sync: trigger invalidateLeadForm on focus".
2. `apps/web/src/hooks/use-lead-form-autosave.ts:126` — autosave hook does
   not listen to the multi-tab event.

## Solution

Implement cross-tab invalidation:

- Add a `useVisibilityChange()` hook or use `document.addEventListener('visibilitychange')`
  to detect when the page regains focus.
- On focus, dispatch a custom event or call `invalidateLeadForm()` to refresh
  the form state from the server.
- Wire this into the autosave hook so edits in Tab A immediately sync to Tab B
  on focus.

## Non-goals

- Change the autosave debounce or timing.
- Implement full real-time bi-directional sync (use-case: two leads editing
  the same section simultaneously is blocked by lock-badge).
- Touch the head-role or archived-report paths.

## Source

- TODO(v8.5-D-multitab) markers in lead-form.tsx and use-lead-form-autosave.ts.
- Regression identified in Phase 41 manual UAT (2026-05-13).

## Activation trigger

(Active — regression from v8.3, needed for v8.5 release readiness.)
