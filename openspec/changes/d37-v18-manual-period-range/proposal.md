# Proposal

## Why

The Admin Periods dialog enables Create or Save for an end date before its start
when the deadline is empty. The server rejects that envelope; the dialog should
identify the reversible input error before submitting it.

## What Changes

- Reuse the existing end-date error surface and submit gate for reversed valid ranges.
- Preserve same-day ranges, create-mode omitted ends, and explicit edit-mode deadline clears.
- Protect both modes through the current public PeriodsTab fixture and real date controls.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-settings-ui`: clarify the existing Admin manual-envelope ordering in its dialog.

## Impact

C4661, external D37-V18 handoff. Sources: `periods-tab-dialog.tsx` and existing
`periods-tab.dialogs.test.tsx` under `apps/web/src/features/period/ui`.
The API contract is grounded in `apps/api/src/modules/admin/period-admin.service.ts`
(`assertEndNotBeforeStart`) and its manual create/update paths. No API changes.

## Non-goals

- Changing native date/number inputs, timezone rules, date parsing, or toolbar layout.
- Introducing a default, new export, dependency, server policy, or error formatter.
- Claiming native UI, Safari, AT, network, database or full-gate acceptance from jsdom.
