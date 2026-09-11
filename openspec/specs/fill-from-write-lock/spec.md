# fill-from-write-lock Specification

## Purpose

Prevent Fill From from mutating a report after publication wins a concurrent race.

## Requirements

### Requirement: Fill From locks the parent Report row before mutating target rows

`fillFromSection` MUST take a `SELECT ... FOR UPDATE` lock on the target
section's parent `Report` row, and MUST re-check that row's `periodStatus`
is `"open"` or `"reopened"`, as the first statement inside its transaction —
before the target section's version compare-and-set and before any
`deleteMany`/`createMany` on the target's `Item`/`Risk`/`Decision` rows. A
period whose locked `periodStatus` is `"published"` MUST cause the
transaction to reject the fill and write nothing, regardless of what the
service-level precheck observed earlier.

This closes the same class of race `saveSection` already closes: a publish
that commits between the service's `assertPeriodNotPublished` precheck and
`fillFromSection`'s transaction never advances `ReportSection.version`, so an
unlocked, unchecked transaction would let Fill From overwrite a now-frozen
published period's live rows. Published readers and search consume the frozen
snapshot, but lifecycle integrity still forbids a post-publication write from
silently diverging the live graph from that immutable document.

#### Scenario: A publish committing mid-race blocks the fill

- **GIVEN** a lead has started `fillFrom` against a target section whose
  report's `periodStatus` is `"open"` at the service-level precheck
- **AND** a publish of that report commits before `fillFromSection`'s
  transaction acquires its lock
- **WHEN** `fillFromSection`'s transaction runs
- **THEN** its locked re-read observes `periodStatus === "published"`
- **AND** the transaction rejects the fill with the existing "Cannot fill a
  section of a published report" error
- **AND** the target section's `Item`/`Risk`/`Decision` rows are left
  unchanged

#### Scenario: A published target is rejected even without a race

- **GIVEN** a target section whose report is already `"published"`
- **WHEN** `fillFromSection` is called against it directly
- **THEN** it rejects before the version CAS and performs zero writes

#### Scenario: An open or reopened target still fills normally

- **GIVEN** a target section whose report's `periodStatus` is `"open"` or
  `"reopened"`
- **WHEN** `fillFromSection` runs with no concurrent publish
- **THEN** the lock check passes, the version CAS proceeds, and the target's
  rows are replaced with the carryable rows from the source section

### Requirement: Fill From rechecks published lineage while holding the Report lock

After locking and validating the target section's parent Report, `fillFromSection` MUST resolve the target's current item and decision stable IDs against published lineage inside the same transaction. It MUST perform this check before the target section version compare-and-set and before deleting or creating child rows. Finding any published item or decision lineage MUST raise the existing typed `PUBLISHED_RECORD_LOCKED` denial and MUST write nothing.

#### Scenario: Publish and reopen finish after the service precheck

- **GIVEN** the service precheck found no published lineage for a target section
- **AND** publish and reopen commit before Fill From locks the target Report without changing the target section version
- **WHEN** Fill From acquires the Report lock and rechecks the target's current lineage
- **THEN** it observes the newly published item or decision identity
- **AND** it raises `PUBLISHED_RECORD_LOCKED` before the version compare-and-set or child deletion

#### Scenario: Reopened target has no published item or decision lineage

- **GIVEN** a target in a valid reopened lifecycle whose current item and decision identities have never been published
- **WHEN** Fill From performs its locked lineage recheck
- **THEN** the lineage check passes
- **AND** the existing version compare-and-set and replacement flow continue
