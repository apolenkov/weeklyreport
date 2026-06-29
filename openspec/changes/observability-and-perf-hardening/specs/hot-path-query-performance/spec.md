## ADDED Requirements

### Requirement: Independent weekly-report queries run in parallel

`getWeeklyReport` MUST issue its independent `leadUsers` and `projects` queries
concurrently (e.g. via `Promise.all`) rather than awaiting one before starting
the other, since neither depends on the other's result.

#### Scenario: Lead users and projects load concurrently

- **GIVEN** a request that builds a weekly report
- **WHEN** the repository fetches `leadUsers` and `projects`
- **THEN** the two queries are dispatched concurrently and awaited together,
  not sequentially

### Requirement: Archive listing paginates at the database

Archive listing MUST paginate at the repository using the existing cursor
contract — `PaginationInput.cursor` (a `reportId`) in, `PaginatedResult.nextCursor`
(the last row's `reportId`, or `null`) out — instead of fetching the entire
archive and slicing in memory. The repository query MUST use a stable ordering of
`publishedAt desc` plus the unique `id` as a tie-breaker so the cursor resumes
deterministically when two rows share a `publishedAt`, and it MUST load the heavy
nested section graph only for rows that need the snapshot-less fallback, not for
every listed row. The public `cursor`/`nextCursor` shape MUST NOT change (no
shared-contract change in this MVP phase).

#### Scenario: First page reads only its rows from the database

- **GIVEN** an archive list request with no cursor and a limit
- **WHEN** the repository queries the archive
- **THEN** the query reads at most `limit` rows in `publishedAt desc, id desc`
  order rather than the whole archive
- **AND** `nextCursor` is the last row's `reportId` when more rows remain

#### Scenario: A cursor resumes after the prior page

- **GIVEN** an archive list request whose `cursor` is a `reportId` from a prior
  page
- **WHEN** the repository queries the archive
- **THEN** it returns the rows that follow that cursor in the stable
  `publishedAt desc, id desc` order, without re-reading earlier rows

#### Scenario: Last or missing cursor yields a null next cursor

- **GIVEN** an archive list request that lands on the final page, or whose
  `cursor` no longer matches any row
- **WHEN** the repository queries the archive
- **THEN** `nextCursor` is `null` so infinite scroll terminates cleanly

#### Scenario: Section graph loads only for snapshot-less rows

- **GIVEN** an archive page where some rows have a stored snapshot and some do
  not
- **WHEN** the service assembles the list
- **THEN** the heavy nested section graph is loaded only for the snapshot-less
  fallback rows

### Requirement: User reconciliation writes in bulk

`upsertUsers` MUST reconcile removed users with a bulk prefetch and a single
`deleteMany` rather than issuing a per-user count+delete, so removing N users
does not cost `O(3N)` sequential queries.

#### Scenario: Removing multiple users uses one bulk delete

- **GIVEN** an `upsertUsers` call that removes several users
- **WHEN** the reconciliation runs
- **THEN** it prefetches the affected rows in bulk and removes them with a
  single `deleteMany`, not a per-user count+delete loop

### Requirement: Organization read does not write on read

`organization.getOrganization` MUST read the organization with `findUnique` and
only fall back to a write (`upsert`/create) when the row is absent, so a normal
read — including the anonymous landing path — does not take a write lock on
every hit.

#### Scenario: Reading an existing organization performs no write

- **GIVEN** the organization row already exists
- **WHEN** `getOrganization` is called (e.g. from the anonymous landing path)
- **THEN** it returns the row via `findUnique` without performing a write

#### Scenario: Absent organization is created once

- **GIVEN** no organization row exists yet
- **WHEN** `getOrganization` is called
- **THEN** it falls back to creating the row, after which subsequent reads are
  read-only

### Requirement: Log pruning does not run per log line

The logger MUST NOT run `readdir`+`stat` directory pruning on every emitted log
line; pruning MUST run only after an actual rotation or on a timer, so log
volume does not drive proportional filesystem churn.

#### Scenario: Emitting a log line does not scan the log directory

- **GIVEN** the application is emitting log lines at volume
- **WHEN** a single log line is written
- **THEN** no `readdir`+`stat` prune scan is triggered by that write

#### Scenario: Pruning runs on rotation or timer

- **GIVEN** the logger is configured with retention
- **WHEN** a rotation occurs or the prune timer fires
- **THEN** the prune scan runs at that point, not on each emit
