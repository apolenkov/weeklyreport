# Proposal

## Why

C0694 (remaining clause): `decideReopenRequest` reads the request, locks the
participant users, then locks the parent report through
`lockCurrentEditableReport`. An administrator may legally delete an open draft
period (`deleteReport`), which cascades its sections and reopen requests. When
that deletion commits between the request read and the report gate, the gate
returns `not-found`, and the decision throws `LeadFormConstraintError`
(`BAD_REQUEST`, "outside an editable report") for a request that no longer
exists. Nothing is mutated; only the outcome is misclassified. The lead-form
fill path already reports `NOT_FOUND` for a section deleted mid-flight.

Backlog: TASK-503.16 (wave 2, candidate C0694).

## What Changes

- A `not-found` report gate in `decideReopenRequest` raises
  `AdminReopenRequestNotFoundError` (`NOT_FOUND`). Publish, archive and other
  non-editable gates keep `LeadFormConstraintError`.
- The race-safe requirement no longer promises that a deleted pending request
  stays pending; it states the not-found outcome for a winning deletion.
- A real-PG regression drives an actual `deleteReport` against a decision
  blocked after its request read.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `reopen-requests`: deletion winning a decision race is reported as not found.

## Impact

`apps/api/src/modules/admin/admin-reopen-request-lifecycle.ts`, its unit test,
and `apps/api/src/modules/report-sections/infrastructure/lead-form-write-lock.integration.test.ts`.

## Non-goals

- Locks, lock order, roles, scope checks and the atomic decision stay unchanged.
- The rejected sub-claim (a draft flip after archive or publish) stays rejected:
  `FOR UPDATE OF report` already serializes those writers.
- This clarifies the contract now; the earlier spec did not mandate `NOT_FOUND`.
