# Proposal

## Why

A Lead's request for decisions due today can select a decision before midnight
and describe it as overdue in the answer after midnight. C1799 reproduces this
through the actual assistant filter, semantic retrieval and grounding in
`report-assistant.service.test.ts`; the RED receipt is retained in the D37-V04
handoff directory.

## What Changes

- Capture one trusted server instant at the start of assistant execution.
- Use that instant for planner date, period selection, exact decision filters
  and grounded decision aggregates throughout the request.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `authorized-report-retrieval`: pin trusted date to one assistant request so
  exact filters and grounding classify the same decision consistently.

## Impact

Only `ReportAssistantService` and its colocated regression change. The public
`tRPC leadForm.assistant` request and outcome schemas stay the same. No database,
provider configuration, deployment or dependency changes are required.

## Non-goals

- Repair cancellation, lease or provider-deadline behavior.
- Change clarification overflow or published-search tie ordering.
- Change lifecycle, authorization or record persistence.
