## ADDED Requirements

### Requirement: Manual period patches protect their audit before-values

`admin.updatePeriodManual` MUST compare changed fields with their expected
before-values under the Report row lock. A range edit MUST also compare both
range boundaries used by validation. A mismatch MUST return the typed stale-state
conflict without a write, reminder reconciliation or success audit. Independent
deadline and weekLabel edits MUST preserve both changes and accurate audit diffs.

#### Scenario: A concurrent writer changes the same field

- **GIVEN** a manual PATCH has read the period and calculated its diff
- **WHEN** another writer commits a different value for a changed field before
  the PATCH acquires the Report lock
- **THEN** the stale PATCH fails with the typed stale-state conflict
- **AND** the committed value remains intact without a stale success audit

#### Scenario: Independent deadline and label changes

- **GIVEN** a deadline PATCH read the period before a weekLabel PATCH committed
- **WHEN** the deadline PATCH acquires the Report lock
- **THEN** both independent changes remain persisted
- **AND** the deadline diff contains its actual committed before-value

#### Scenario: A range precheck becomes stale

- **GIVEN** a manual PATCH validates a new periodStart against the current periodEnd
- **WHEN** another writer changes periodEnd before the PATCH acquires the Report lock
- **THEN** the stale PATCH fails with the typed stale-state conflict
- **AND** it cannot persist a combined range that its precheck did not validate
