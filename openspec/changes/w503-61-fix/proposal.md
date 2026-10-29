# Proposal

## Why

In `apps/web/src/features/period/ui/report-history-toolbar.tsx:23-40`, the Archive toggle pill (`<label>`) renders hover styles (`hover:bg-[var(--color-success)] hover:text-[var(--color-starbucks-accent)]`), but lacks focus-within ring classes (`focus-within:ring-2 focus-within:ring-[var(--color-ring)]`). When navigating using keyboard tabbing, focus moves into the inner checkbox (`input[type="checkbox"]`), while the custom enclosing pill container provides no custom visible focus ring.

This defect was identified under TASK-503.61 (C4699, browser chunk 4 verification). Adding `focus-within:ring-2 focus-within:ring-[var(--color-ring)]` to the `<label>` element brings it into parity with the project's pill focus styling (e.g. `item-inline-editor.tsx`), preserving accessibility, keyboard discoverability, and visual fidelity.

## What Changes

- In `apps/web/src/features/period/ui/report-history-toolbar.tsx` (`HistoryArchiveToggle`), add `focus-within:ring-2 focus-within:ring-[var(--color-ring)]` to the archive toggle `<label>` pill className.
- Update `archive-history-ia` spec to require that the archive toggle pill indicator reflects keyboard focus on the enclosing pill via focus-within styling.
- Add regression assertions in `report-history-toolbar.test.tsx` verifying that the archive toggle label carries the `focus-within:ring-2` and `focus-within:ring-[var(--color-ring)]` classes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `archive-history-ia`: Archive navigation control provides visible focus indication on its pill container when focused.

## Impact

- `apps/web/src/features/period/ui/report-history-toolbar.tsx`
- `apps/web/src/features/period/ui/report-history-toolbar.test.tsx`
- No API, database schema, or persistence changes.
