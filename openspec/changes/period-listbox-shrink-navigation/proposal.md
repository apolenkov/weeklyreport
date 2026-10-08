## Why

When a refetch removes several periods from an open PeriodNavigator, its highlight clamps to a surviving option but the first ArrowUp can leave it there. Final MR !82 review I1 identified that keyboard users must press repeatedly before moving upward.

## What Changes

- Make arrow navigation continue from the surviving highlighted option after a refetch.
- Extend the existing public PeriodNavigator tests with single- and multiple-option removal followed by one ArrowUp and Enter or Space.
- Clarify the existing changing-options contract with this continuation scenario.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dialog-listbox-a11y`: Period listbox remains addressable when its options change, including the next arrow transition.

## Impact

The owner is `apps/web/src/features/period/model/use-period-listbox-nav.ts`; tests remain in `apps/web/src/features/period/ui/period-navigator.test.tsx`. The existing contract is `openspec/specs/dialog-listbox-a11y/spec.md`; review evidence is in the completion handoff's `mr82-final-review.md`.

## Non-goals

- No layout, gesture, backend, database, or dependency change.
- No new production export or state-synchronization effect.
