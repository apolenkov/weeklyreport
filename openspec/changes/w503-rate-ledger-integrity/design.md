# Design

## Context

See proposal.md. `worker.ts` and `scenario-api.ts` share ledgers by stand;
`press.ts` reserves before browser work and writes signed corrections after
observing actual requests. `pace` already holds a file lock while reading and
appending. The prior ENOENT-only fix preserves filesystem failure causes.

## Goals / Non-Goals

Validate persisted input at the existing reservation boundary. Preserve signed
corrections, file format, lock failure ownership, and first-run behavior.
Reservation identity checks and refund association are outside this change.

## Decisions

Before: persisted row → unchecked Number conversion → used → admission.
After: persisted row → exact integer field validation → used → admission;
corruption → existing lock release → visible integrity failure.

Reject the entire read on corruption rather than skipping or compacting rows:
unknown request consumption cannot safely become unused budget. Accept signed
counts because legitimate corrections use `actual - reserved`. Accept one
trailing newline written by the producer, but reject blank interior rows.

## Risks / Trade-offs

- Corrupt history stops crawling → retain bytes for diagnosis; no silent repair.
- A syntactically valid forged signed correction remains indistinguishable from
  a refund → existing ledger identity policy is unchanged.

## Migration Plan

No migration or dependencies. Valid existing producer records retain their
format. Rollback restores the parser; database guards, report lifecycle and
role middleware are unaffected. No app/API callers change.
