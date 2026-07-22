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
published period's live rows — rows the viewer's published SEARCH reads
directly (not the frozen snapshot), which would surface content absent from
the report a viewer actually opens.

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
  rows are replaced with the carryable rows from the source section exactly
  as before this change
