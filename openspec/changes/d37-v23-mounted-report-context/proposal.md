# Proposal

## Why

An Overview editor can trap Cancel during a delayed save, and an old overview target can shadow a new deep-link product focus on the mounted weekly report. The corrected round2 D37-V23 handoff demonstrates both at the existing public consumers; `lead-status-overview`, `report-card-clarity` and `dialog-listbox-a11y` own their requirements.

## What Changes

- Keep Cancel operable while the existing pending editor locks its fields and Save.
- Drop only the previous overview navigation target and activation epochs when the report/deep-link basis changes, allowing the current focus to take effect.
- Keep the empty product header free of a disclosure state for a nonexistent panel.
- Preserve the source-only loading toolbar alignment with its live owner.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-status-overview`: clarify pending-save cancellation through the existing canonical editor.
- `report-card-clarity`: scope overview navigation intent to the current mounted report/focus basis.
- `dialog-listbox-a11y`: clarify the empty-product header's absent panel semantics.

## Impact

Only the six exact paths of corrected round2 D37-V23. No request cancellation guarantee, mutation path, schema, dependency or configuration changes. The toolbar correction retains the existing responsive geometry contract without a new requirement.

## Non-goals

- No FIFO cap, memoization, Safari workaround or missing-event navigation fallback from the rejected earlier patch.
- No changed ordering policy, rollback of a pending save, or native AT/layout acceptance claim.
