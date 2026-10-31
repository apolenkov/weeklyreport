# Proposal

## Why

TASK-503.65 (C5001 family) found that the inline item editor installed its
unload and navigation guard unconditionally. The Overview plan composer
(`OverviewPlanComposer`) still calls `useInlineEditUnloadGuard()` without an
argument, so a pristine composer prompts the lead before leaving the page.

## What Changes

- The composer passes `isPlanInputEdited(state)` to the unload guard, so the
  warning fires only while input differs from the opened baseline.
- The dirty definition is the one the composer's discard guard already uses
  (`isPlanInputEdited`), so the outcome choice alone does not arm the guard.
- Colocated test for the composer covering pristine, edited and reset states.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-status-overview-actions`: the Overview plan composer warns on page
  unload and in-app navigation only while it holds edited input.

## Impact

- `apps/web/src/features/report-pages/ui/lead/shell/overview-plan-composer.tsx`
- `apps/web/src/features/report-pages/ui/lead/shell/overview-plan-composer.test.tsx` (new)

## Non-goals

- No change to `useInlineEditUnloadGuard` itself or to the item inline editor
  (already gated by commit 0d9c92e32 and `openspec/changes/w503-65-fix`).
- No change to the discard dialog or to draft persistence.
- No native browser prompt verification; jsdom evidence only.
