## Context

See proposal.md and the existing dialog-listbox-a11y contract. Rendering bounds the stored highlight after refetch; ArrowUp currently subtracts from the unbounded stored index instead.

## Goals / Non-Goals

Keep the functional state updater so consecutive keyboard events compose. Preserve read-time clamping, empty-list handling, direct selection, focus and scrolling ownership.

## Decisions

Bound the updater's previous index to the current final option before moving upward. A read-time-only bound cannot correct transitions; using a captured rendered index would lose queued updates. An effect that synchronizes state would introduce an unnecessary intermediate render and event timing window.

Keep the regression at the public PeriodNavigator boundary. Use existing three- and four-option fixtures, shrink both to two, then one ArrowUp followed by Enter or Space. Address the second surviving period so selecting the first must produce navigation rather than a current-period no-op. Retain existing immediate-selection and empty-list tests.

Period dual-state, role coverage and destructive-database guards are unchanged: this is frontend navigation state only. No migration, backend request contract or dependency change is required.

## Risks / Trade-offs

- jsdom observes active descendant, focus, scroll calls and addressed navigation; it does not prove actual viewport visibility. Final product browser acceptance remains a separate full-plan gate.
- Full root tests after a prior build can discover generated standalone copies. Remove only this task-owned generated build output before clean verification; preserve evidence logs.
