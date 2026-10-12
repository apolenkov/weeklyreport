# Tasks

- [x] 1. Spec delta for `admin-snapshot-restore`.
- [x] 2. `adminSnapshotRestoreSchema` and its use in `saveSnapshot`.
- [x] 3. Unit tests: inverted row, reopened retained envelope, draft row, one-day control, stored inverted snapshot stays readable (admin export, published snapshot, open work).
- [ ] 4. Native check: `saveSnapshot` with an inverted published period on a guarded target is rejected before any row is created.
