# Design

## Decisions (008, 2026-10-15)

- **C2139.** The unit config pins `REDIS_HOST=redis.invalid` through Vitest
  `test.env`, which overrides an inherited shell value. The shared setup file
  keeps `??=` because the coverage contour also uses it and must reach the
  guarded Redis from `.env.test`. The isolation test is unit-only, so the
  coverage contour excludes it.
- **C0707/C0724: no lock.** Restore already maps a unique violation to
  `AdminSnapshotConflictError` and rolls back as a whole. Adding
  `lockStatusGraph` to `saveReportingGroup` would only turn that typed
  conflict into a wait, so the PostgreSQL test pins the current behaviour.
- **C1665: no lock.** The lineage is the union of frozen snapshots and
  projection rows. A publication writes both in one transaction, and a
  restore that removes ids can only leave a superset, so a mixed read never
  drops a lock. The PostgreSQL test pins the publication case.
- **C0976.** `getControl` reads the control row and the revision list in one
  REPEATABLE READ transaction. Writers keep their compare-and-set guard.
- **C1219, C0766, C1805.** These are covered by existing PostgreSQL tests, so
  this change adds no code for them.
