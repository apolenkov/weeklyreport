## ADDED Requirements

### Requirement: At Most One Open Period Per Boundary Is Enforced By The Database

The database SHALL reject a second `Report` row whose `("periodStart","periodEnd")` boundary equals an existing row's boundary while both rows have `periodState = 'open'`, via a partial unique index named `Report_one_open_per_boundary` defined in the init migration. The application MUST NOT rely on an unenforced schema comment for this invariant.

The index covers only open periods with identical boundaries; periods in any non-`open` state (e.g. `scheduled`, `published`, `archived`) are exempt, so a closed period and a new open period may share a boundary.

#### Scenario: Two concurrent inserts for the same open boundary

- **GIVEN** no open `Report` exists for the boundary `(periodStart=W, periodEnd=W')`
- **WHEN** two writers each insert a `Report` with `periodState = 'open'` and boundary `(W, W')` concurrently
- **THEN** the first insert commits
- **AND** the second insert is rejected by `Report_one_open_per_boundary` with Prisma error code `P2002`

#### Scenario: A closed period does not block a new open period on the same boundary

- **GIVEN** an existing `Report` on boundary `(W, W')` with `periodState = 'published'`
- **WHEN** a writer inserts a new `Report` on the same boundary with `periodState = 'open'`
- **THEN** the insert succeeds, because the partial index only constrains rows where `periodState = 'open'`

#### Scenario: The schema comment matches the migration

- **WHEN** the `Report` model comment in `prisma/schema.prisma` describes `Report_one_open_per_boundary`
- **THEN** the same index exists in `prisma/migrations/20260530162224_init/migration.sql`
- **AND** the comment names what stays application-level best-effort (true cross-range overlap and overlap involving non-open periods)

### Requirement: Admin Period Create And Update Translate The Constraint Violation Into A Domain Error

The admin manual period create and update paths SHALL catch the `Report_one_open_per_boundary` `P2002` violation and throw `AdminPeriodOverlapError` (mapped to `BAD_REQUEST`), never surfacing it as an unhandled 500. The existing `findOverlappingPeriod` pre-check remains as the friendly, message-rich first line of defence.

#### Scenario: A race defeats the pre-check on manual create

- **GIVEN** `createPeriodManual` passes the `findOverlappingPeriod` pre-check for boundary `(W, W')`
- **WHEN** a concurrent writer inserts an open period on `(W, W')` before this insert commits
- **THEN** the insert raises `P2002` on `Report_one_open_per_boundary`
- **AND** the repository translates it into `AdminPeriodOverlapError`
- **AND** the client receives a `BAD_REQUEST` tRPC error, not a 500

#### Scenario: A race defeats the pre-check on manual update

- **GIVEN** `updatePeriodManual` changes a period envelope and passes the `findOverlappingPeriod` pre-check
- **WHEN** the update would collide with a concurrently-created open period on the new boundary
- **THEN** the update raises `P2002` on `Report_one_open_per_boundary`
- **AND** the repository translates it into `AdminPeriodOverlapError` (→ `BAD_REQUEST`)

### Requirement: First-Login Weekly-Report Creation Recovers From The Constraint Violation

`ensureWeeklyReport` in `apps/api/src/modules/auth/auth.routes.ts` SHALL catch the `Report_one_open_per_boundary` `P2002` violation on its `report.create` and recover by re-reading the row that actually triggered the violation, so concurrent first-logins converge on a single period instead of failing with a 500.

The recovery re-read MUST match the index predicate — the `Report` on the current week boundary with `periodState = 'open'` — NOT the `status = 'draft'` filter the prior lookups use. Because `periodState = 'open'` also covers a reopened period (`status = 'published'`, `periodStatus = 'reopened'`), the colliding row may be published; a `status = 'draft'` re-read would miss it and leave recovery empty.

#### Scenario: Two leads log in for the first time the same week

- **GIVEN** no open `Report` exists for the current week
- **WHEN** two lead users hit the login path concurrently and both pass the existing-report check
- **THEN** the first `report.create` commits the week's open period
- **AND** the second `report.create` raises `P2002`, is caught, re-reads the open period on that boundary, and uses its id
- **AND** both logins resolve to the same `reportId` with no 500

#### Scenario: The blocking open row is a reopened (published) period

- **GIVEN** a `Report` on the current week boundary that was reopened, so `status = 'published'`, `periodStatus = 'reopened'`, and `periodState = 'open'`
- **WHEN** a lead logs in, the `status = 'draft'` lookups miss the published row, and `report.create` raises `P2002` on `Report_one_open_per_boundary`
- **THEN** the recovery re-read keys on the boundary with `periodState = 'open'` and resolves to that reopened period's id
- **AND** the login succeeds with no 500 and creates no duplicate

#### Scenario: Non-P2002 failures still propagate

- **WHEN** `report.create` in `ensureWeeklyReport` fails for any reason other than the `Report_one_open_per_boundary` `P2002`
- **THEN** the error is re-thrown unchanged, so unrelated failures are not masked as a successful re-read

### Requirement: The Database Guard Is Covered By An Automated Test

At least one automated test SHALL prove the `Report_one_open_per_boundary` index has teeth by inducing the duplicate-open-boundary insert against a real database and asserting the second insert is rejected, plus an application-level test asserting the `P2002` is translated (not surfaced as a 500).

#### Scenario: The index rejects a duplicate open boundary

- **WHEN** an integration test inserts two open `Report` rows with the same `(periodStart, periodEnd)` against the `_test` database
- **THEN** the second insert throws `P2002` referencing `Report_one_open_per_boundary`

#### Scenario: The translation test fails if the catch is removed

- **WHEN** the admin-create / `ensureWeeklyReport` `P2002` catch is removed
- **THEN** the corresponding test fails, proving it guards the translation rather than passing vacuously
