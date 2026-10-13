# Proposal

## Why

The Admin period dialog can forward an Invalid Date from a start or end input accepted by the jsdom date control instead of explaining the invalid field. TASK-503 C4659 has preserved RED evidence in `wave-01/web-final-period-input.log`; the existing reversed-range contract in `d37-v18-manual-period-range` assumes both dates are already valid.

## What Changes

- Reject unparseable start and supplied end dates before create/edit submission.
- Show an accessible error on the affected field and remove it after correction.
- Preserve valid UTC envelopes, omitted create ends, required edit ends and existing deadline semantics.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-settings-ui`: manual period dialogs require parseable supplied envelope dates.

## Impact

The change owns `periods-tab-dialog.tsx`, `periods-tab-dialog-fields.tsx` and the existing `periods-tab.dialogs.test.tsx`. Parent task: TASK-503. Native extended-year admission is a separate coordinator check.

## Non-goals

- No new year, calendar, timezone, server schema or persistence policy.
- No changes to deadline parsing, C4604, shared configuration, dependencies or other UI owners.
