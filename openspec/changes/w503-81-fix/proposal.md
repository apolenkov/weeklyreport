# Proposal

## Why

In `packages/ui/src/components/ui/sheet.tsx`, `SheetHeader` has padding `p-4` with no right padding clearance for the absolute close button (`SheetPrimitive.Close`, positioned `top-2 right-2 size-11`). On compact screens (such as 375px mobile viewport in `mobile-nav.tsx`), long titles or content in `SheetHeader` underlap the close button (documented under TASK-503.81 C5362 in `rev-waves-2-RESULT.md` and `chunk-3b-RESULT.md`).

## What Changes

- Update `SheetHeader` in `packages/ui/src/components/ui/sheet.tsx` to provide right clearance for the absolute close control by default (`pr-12` or `pr-14`), while allowing callers' `className` to customize layout when appropriate.
- Verify existing Sheet consumers (`mobile-nav.tsx`, `lead-report-assistant.tsx`) continue to render properly without broken layout or visual conflict.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-control-density`: Clarify that SheetHeader provides sufficient trailing padding clearance for the Sheet close button to prevent title and action content from underlapping the close control.

## Impact

- `packages/ui/src/components/ui/sheet.tsx`
- Co-located and consumer regression tests in `apps/web/src/shared/ui/style/` or navigation tests.
- Zero API, database, or backend changes.

## Non-goals

- Altering `SheetContent` overall positioning or drawer animations.
- Redesigning `mobile-nav.tsx` or `lead-report-assistant.tsx`.
