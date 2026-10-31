# Tasks

## 1. Contract

- [x] 1.1 Admin user save input validates free text as safe text; the read contract stays unchanged (TASK-503.112, C2875).

## 2. Implementation

- [x] 2.1 RED: input-schema tests for invisible-only and null-byte name parts and position, nullable optional parts accepted, and read-contract acceptance of stored values.
- [x] 2.2 Add `adminUserInputSchema` built from the shared object shape; wire `saveUser` and `SnapshotAdminService.upsertUser` to it.
- [ ] 2.3 GREEN; repository gates on the reviewed tree.
