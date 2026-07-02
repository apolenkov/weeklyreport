## MODIFIED Requirements

### Requirement: Atomic Dual-State Write

Every writer that mutates a `Report` period MUST update both `periodState` and the legacy period tuple in the same Prisma transaction, never in separate database round-trips.

#### Scenario: Lead section save does NOT write the Report period

- **WHEN** the lead save path saves a section via
  `apps/api/src/modules/report-sections/` (the `weekly-report` module only reads
  the `Report`)
- **THEN** the transaction writes `reportSection` / `item` / `risk` / `decision`
  / `projectStatus` / `stageStatus` / `activityStatus` rows only
- **AND** it writes no `Report` period field, so it is NOT a period writer and is
  exempt from this invariant

#### Scenario: Head publish updates both fields

- **WHEN** the head publish path in `apps/api/src/modules/publication/` transitions a `Report` to published state
- **THEN** both `periodState` and the legacy period tuple are written in the same transaction, with no intermediate commit containing only one of the two representations
