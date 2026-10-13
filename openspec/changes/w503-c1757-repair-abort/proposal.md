# Proposal

## Why

A Lead can receive `invalid_plan` after the assistant request deadline has expired when a pending planner repair returns malformed data. TASK-503 / C1757 requires the existing deadline outcome, `provider_unavailable`, to take precedence over that late result.

## What Changes

- Check the request cancellation signal immediately after planner repair completes, before validating the repaired plan.
- Clarify the deadline precedence scenario in the existing assistant outcome contract.
- Verify the public service through the real planner adapter and transport with an injected fetcher and the production request-deadline timer; retain lease-loss and ordinary invalid-plan controls.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-report-assistant`: late planner repair results cannot override the request deadline outcome.

## Impact

`apps/api/src/modules/search/application/report-assistant.orchestration.ts` and `report-assistant.service.test.ts`. The caller and contract are `ReportAssistantService.answer` and `openspec/specs/lead-report-assistant/spec.md`. Diagnosis and adapter RED are in `~/work/handoffs/task-503/wave-08/ADVICE-C1757-ASTRA.md` and `c1757-adapter-red.log`; the earlier lease-only baseline GREEN is preserved in `c1757-lease-only-red.log`.

## Non-goals

- No timeout configuration, production test seam, retry, transport protocol or dependency change.
- No database, Redis, native app, browser or full repository gate execution by this implementer.
- No universal cancellation guarantee for every provider or runtime path; independent review and delivery remain with the coordinator.
