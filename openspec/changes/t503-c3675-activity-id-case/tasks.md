# Tasks

- [x] 1. Spec delta for `activity-reporting-unit`.
- [x] 2. One module-local `canonicalUuid` on every write-side id.
- [x] 3. Unit tests with letter-bearing ids (create, update, archive, lead edge).
- [ ] 4. Native check: guarded API integration calling update, archive, attachLead and detachLead with uppercase ids of seeded rows.
- [ ] 5. Native check: read-only scan on live targets for `id <> lower(id)` in ReportingGroup, User and ProjectActivity (expect 0).
