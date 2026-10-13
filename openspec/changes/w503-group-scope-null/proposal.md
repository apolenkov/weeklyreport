# Proposal

## Why

A null repository scope session bypasses the explicit missing-session error
required by `repository-scope-guard` (TASK-503 C0584). The guard-only
`getCurrentEditableIdForSession` then constructs a query without reading the
session, unlike callers that subsequently access role fields.

## What Changes

- Reject null alongside undefined with the existing missing-session diagnostic.
- Clarify both absent values in the existing repository-scope requirement.
- Extend the existing regression and preserve all valid role behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `repository-scope-guard`: explicitly classify null and undefined as missing.

## Impact

`apps/api/src/lib/group-scope.ts` and its existing colocated test. The canonical
HTTP authentication middleware already rejects null; this corrects the local
repository defensive boundary without changing role access or query filters.

## Non-goals

- No generic session-shape validation or new role policy.
- No claim of an admitted unauthenticated HTTP read.
