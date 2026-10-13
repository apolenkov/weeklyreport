# Proposal

## Why

Concurrent organization saves can record the wrong preceding name in the audit log. TASK-503 C0464 real PostgreSQL RED (`native-core-r2-baseline.log`) shows A recording Initial after B already committed.

## What Changes

- Capture the preceding and updated singleton identities within one locked repository transaction.
- Have `admin.updateOrganization` use that captured pair for structured audit while returning its existing Organization DTO and clearing the organization cache.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `audit-target-coverage`: organization identity audit records the actual immediately preceding committed identity.

## Impact

Organization repository/service, admin settings procedure and existing module tests. Tracked by TASK-503, wave 01, C0464. Coordinator owns guarded native verification and repository gates.

## Non-goals

- No migration, versioning policy, singleton creation, dependencies or configuration changes.
- No changes to the durable UserActionLog allowlist, other settings or middleware.
