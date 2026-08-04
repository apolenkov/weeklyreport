## Why

The exhaustive per-file audit is now complete (`3930/3930`, pending `0`) and found 13 P0 defects that can expose stale report data, admit contradictory period lifecycle state, overwrite concurrent writes, leave SAML/PDF security behavior unproved, or restore a database selected by an incomplete confirmation. The evidence and execution index are preserved in `~/work/customreport-archive/2026-07-30-exhaustive-style-audit/{FINDINGS.md,CONSOLIDATION.md}`.

## What Changes

- Make every current period schema, reader, factory, login resolver, section writer, and admin transition fail closed on missing or contradictory lifecycle state.
- Replace stale lifecycle writes and project/activity group updates with tuple-guarded atomic compare-and-set operations.
- Strengthen the lifecycle AST gate so aliases, computed access, spread/data helpers, and malformed exemptions cannot bypass it.
- Prevent lead-form quick actions from applying data from a previously selected report.
- Replace the skipped PDF E2E and TODO-only SAML signature coverage with executable positive and adversarial integration evidence.
- Require PostgreSQL restore confirmation to identify the exact host, port, database, and production-destructive intent.
- Add regression ratchets for all 13 accepted P0 findings before any finding is marked resolved.
- **BREAKING**: incomplete legacy lifecycle payloads are no longer accepted by current schemas; compatibility must pass through an explicit versioned normalizer.

### Non-goals

- Fixing the remaining 229 P1, 103 P2, or 9 P3 specific findings in this change.
- Executing the ten repo-wide style/test cleanup epics; they remain the next campaign.
- Adding new product features or changing intended role permissions.

## Capabilities

### New Capabilities

- `critical-integrity-repair-gate`: Evidence and ratchet requirements for resolving the audit's accepted P0 queue.

### Modified Capabilities

- `period-dual-state`: Require strict current wire tuples, fail-closed reads, and atomic guarded transitions.
- `period-scheduler-wiring`: Exclude archived or contradictory rows from lazy/current-period resolution.
- `report-section-write-gates`: Reject unknown lifecycle state at every section write seam.
- `lead-form-draft-orchestration`: Bind quick actions to the currently selected report generation.
- `saml-provisioning`: Require executable signature-validation integration coverage.
- `pdf-export-integrity`: Replace skipped completion coverage with an executed assertion path.
- `admin-entity-write-integrity`: Serialize project group moves and activity attachment validation.
- `destructive-db-guard`: Confirm the complete restore target and production intent.

## Impact

Affected areas include shared Zod schemas, period/auth/admin/report-section services and repositories, lifecycle lint tooling, lead-form state orchestration, SAML/PDF integration harnesses, PostgreSQL restore operations, and their OpenSpec/gate evidence. MVP schema freedom is used only to tighten current contracts; production destructive operations remain prohibited without the explicit guard.
