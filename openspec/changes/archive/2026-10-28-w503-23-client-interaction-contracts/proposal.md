# Proposal

## Why

Search results use an input-owned keyboard model while their option buttons can receive separate Tab focus, leaving focus and the active result out of sync. The saving control declares reduced-motion support that can lose to its inline animation.

## What Changes

- Give the search combobox one Tab stop: result options leave the Tab order, the input keeps Arrow/Enter/Escape and `aria-activedescendant`, and the popup closes when focus moves to the next external control.
- Reveal the active result inside the scrollable popup during keyboard navigation without moving focus or the document.
- Strengthen the existing SearchInput focus-exit regression with actual user-event Tab traversal instead of manually supplying the expected blur target, and cover the active-result reveal.
- Specify stationary save feedback for reduced motion while preserving busy, disabled, success and retry behavior; its production repair still follows native motion observation.

TASK-503.23 also tracks C5220 auth refetch, C5339 cached search errors, C5352 debounce selection and C0007 card clipping. Those need separate policy or observable evidence; this proposal does not authorize stale authenticated rendering, removal of retained search results, changes to query limits, or global card overflow changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-report-controls-integrity`: reduced-motion behavior of the busy save control.
- `dialog-listbox-a11y`: keyboard focus and active-result visibility for the search combobox popup.

## Impact

Owners are SaveNowButton and SearchInput/controller/dropdown. This change touches the search combobox, its option-id contract and the colocated component tests; the saving-motion repair remains unimplemented until native observation. No API, database, dependency or authorization change is proposed.

Tracking: TASK-503.23; source, immutable clauses and runtime nomination are retained in `/home/user/work/handoffs/task-503/web-contracts-23/`.
