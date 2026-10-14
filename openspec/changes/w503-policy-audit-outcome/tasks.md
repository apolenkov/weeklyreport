# Tasks

Linked execution task: TASK-503.19; confirmed findings C0456/C0786.

## 1. API transaction outcome and audit

- [x] 1.1 Add the public admin/real PostgreSQL audit regression and record a genuine baseline RED: concurrent saves must yield one create and one update, not two creates.
- [x] 1.2 Return the actual insert outcome from the existing policy/rules transaction, with bounded missing-row retry and typed conflict; verify native concurrency, delete-before-lock, retry exhaustion and rollback scenarios.
- [x] 1.3 Propagate the validated internal outcome through repository/service and audit while preserving the public DTO; remove the stale existence path and obsolete fixtures, and run focused owner/sibling tests.

## 2. Integration acceptance

- [ ] 2.1 On the reviewed tree run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm spec:check`; retain SHA-bound receipts outside the product tree.
- [ ] 2.2 Obtain independent Astra review of the exact diff/SHA and deliver evidence to the coordinator before integration.

## Workflow follow-up

- The coordinator integrates with F's period-envelope/CAS signatures and the separate queue repair package; do not change those owners' files.
- Archive only after acceptance and retain native RED/GREEN and reviewer evidence externally.
