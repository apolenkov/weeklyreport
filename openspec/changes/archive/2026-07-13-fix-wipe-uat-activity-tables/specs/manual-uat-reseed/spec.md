## ADDED Requirements

### Requirement: Manual-UAT wipe MUST delete all FK-dependent tables in FK-safe order

The `prisma/wipe-manual-uat.ts` transactional wipe MUST delete every table that
a foreign key can restrict — including the project-activity tables
`activityStatus`, `projectActivityLead`, `projectActivityProduct`, and
`projectActivity` — in an order that clears each `ON DELETE RESTRICT` child
before its parent, so the combined wipe+reseed transaction completes on any
database provisioned by the standard seed rather than rolling back on a foreign
key violation.

Because `ProjectActivity.groupId` and `ProjectActivityProduct.productId` are
`ON DELETE RESTRICT`, the four activity deletes MUST run before
`reportingGroup.deleteMany` and `project.deleteMany`, in the order
`activityStatus` → `projectActivityLead` → `projectActivityProduct` →
`projectActivity`.

#### Scenario: Manual-UAT reseed against a standard-seeded database

- **WHEN** `wipe-manual-uat.ts` runs against a non-prod database that was
  provisioned by `seed-simple.ts` (and therefore contains project-activity
  rows)
- **THEN** the wipe deletes the activity tables before `reportingGroup` and
  `project`, so no `ON DELETE RESTRICT` foreign key violation is raised
- **AND** the single wipe+reseed transaction commits, leaving the reseeded
  baseline in place

#### Scenario: Activity deletes precede their restricting parents

- **WHEN** the transactional delete map executes
- **THEN** `activityStatus`, `projectActivityLead`, `projectActivityProduct`,
  and `projectActivity` are all deleted before `reportingGroup.deleteMany` and
  `project.deleteMany` run
