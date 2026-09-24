# publish-compare-and-set (delta, P2-01)

## Purpose

Require at least one submitted section before a manual publish, so an empty period can never become published.

## ADDED Requirements

### Requirement: Manual publish requires a submitted section

`PeriodPrismaRepository.publishPeriod` MUST count sections with `status: "submitted"` inside the publish transaction after the parent Report lock and MUST throw `PeriodAccessError` when the count is zero, leaving the period open. The guard runs before reminder-rule pausing and the version bump.

Consumer surfaces: `apps/api/src/modules/period/infrastructure/period.prisma-repository.ts`, the publish atomicity integration suite, and the repository Reticle coverage gate.

#### Scenario: Publication with no submitted section is rejected

- **WHEN** a publish is attempted on a report with zero submitted sections
- **THEN** the call rejects with `PeriodAccessError`
- **AND** the report stays open with no version bump, snapshot, or side effects
