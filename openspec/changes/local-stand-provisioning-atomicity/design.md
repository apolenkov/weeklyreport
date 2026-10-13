# Design

## Context

See `proposal.md` for the observed problem. The documented consumer sends SQL
through psql stdin with `ON_ERROR_STOP=1`; stopping at an error does not roll
back previous autocommitted statements. No current deployment contract owns
atomic local-stand provisioning. SAML login is a separate create-only boundary.

## Goals / Non-Goals

**Goal:** Satisfy the rollback contract in
`specs/local-stand-provisioning/spec.md` without changing the three write bodies.

**Non-goals:** See the proposal. In particular, the fixed head UUID remains an
existing constraint: a foreign-ID e-mail match may still fail, but its failure
must now roll back the entire run.

## Decisions

Wrap all three statements in one explicit `BEGIN` / `COMMIT`. This keeps the
existing stdin command intact. `ON_ERROR_STOP` alone was rejected because it
stops execution after earlier commits; a client sending the entire SQL string
in one pg simple-query call is not the documented execution boundary.

```text
Before: group commit -> user commit -> head failure -> partial graph
After:  BEGIN -> group -> users -> head -> COMMIT -> complete graph
                                      -> failure -> connection exit -> rollback
```

Keep the original statements byte-for-byte: roles, identity fields, conflict
arbiter, fixed IDs, and the non-null-head guard remain their current policies.
Report period dual-state and canonical middleware are untouched. The destructive
DB guard remains mandatory for runtime verification.

## Risks / Trade-offs

- The group check-then-insert still has an unverified concurrency claim -> keep
  C0139 open for that sibling; this change promises atomicity only.
- Existing foreign-ID and identity mismatch issues are not repaired by a
  transaction -> preserve their constraints and reasons for separate adjudication.
- Source inspection cannot demonstrate database rollback -> the coordinator runs
  actual psql stdin late-FK and user-collision controls, positive provisioning,
  and sequential replay on an exact guarded synthetic target.

## Migration Plan

No schema migration, feature flag, application API, or UI change is required.
Deliver the SQL file and active contract together after coordinator validation.
The delegated executor runs guarded native psql and all six repository gates
on the candidate SHA. No production or Kubernetes deployment is performed.
Coordinator wrk-42 owns independent review and authorizes delivery to main.
