# Tasks

## 1. Contract

- [x] 1.1 Validate stage ownership of new and changed records only (C2903, 008 decision).

## 2. Implementation

- [x] 2.1 Replace the unchanged-row rejection test with an acceptance test that edits another row; keep the smuggle and no-lineage rejections; RED before the change.
- [x] 2.2 Skip unchanged rows in the shared stage-ownership guard.
- [x] 2.4 Review: treat a record as unchanged only when it adds no stage beyond its stored stages; seed ownership tests validate every row as new; item-outcome accept/reject tests.
- [ ] 2.3 Full gates and independent review.
