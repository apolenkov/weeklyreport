# hot-path-query-performance Specification

## Purpose

Keep high-volume read and reconciliation paths bounded, deterministic, and free
of avoidable sequential database work.

## Requirements

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

Archive listing MUST paginate at the repository using an opaque keyset cursor
in `PaginationInput.cursor` and `PaginatedResult.nextCursor` out, instead of
fetching the entire archive and slicing in memory. The cursor encodes the
`(publishedAt, id)` coordinate of the last row. The repository query MUST use a
stable ordering of `publishedAt desc` plus the unique `id` as a tie-breaker.
Archive content MUST come
only from the validated immutable `publishedSnapshot`; the repository MUST NOT
load or rebuild a mutable nested section graph fallback. To decide `nextCursor` without re-reading the whole archive, the
query MUST fetch one probe row beyond the page (`take: limit + 1`): it returns at
most `limit` items, and the presence of the extra `(limit + 1)`th row is what marks
that more rows remain. The public `cursor`/`nextCursor` shape MUST remain
stable.

#### Scenario: First page reads only its rows from the database

- **GIVEN** an archive list request with no cursor and a limit
- **WHEN** the repository queries the archive
- **THEN** the query reads at most `limit + 1` rows (one probe row beyond the page)
  in `publishedAt desc, id desc` order rather than the whole archive
- **AND** it returns at most `limit` items, and `nextCursor` is an opaque cursor
  for the last returned row when the probe row is present, else `null`

#### Scenario: A cursor resumes after the prior page

- **GIVEN** an archive list request whose `cursor` is an opaque cursor from a
  prior page
- **WHEN** the repository queries the archive
- **THEN** it returns the rows that follow that cursor in the stable
  `publishedAt desc, id desc` order, without re-reading earlier rows

#### Scenario: Last page yields a null next cursor and malformed cursors fail

- **GIVEN** an archive list request that lands on the final page
- **WHEN** the repository queries the archive
- **THEN** `nextCursor` is `null` so infinite scroll terminates cleanly

- **WHEN** a present cursor is malformed
- **THEN** the request fails with HTTP 400 instead of restarting at page one

#### Scenario: Snapshot-less rows fail closed

- **GIVEN** an archive page containing a published archived row without a
  stored snapshot
- **WHEN** the service assembles the list
- **THEN** the read fails closed and does not load mutable section content

### Requirement: Snapshot user writes remain additive and explicit removals are bounded

The whole-snapshot restore's `upsertUsers` MUST remain additive-only: it may
prefetch current ids and upsert/create each user present in the snapshot, but it
MUST NOT infer removals from absent snapshot rows. Explicit user removal uses the
dedicated admin remove command. It MAY perform bounded reference guards,
including the mandatory published-history lookup, and then uses one idempotent
`deleteMany` operation rather than reconciling every omitted snapshot user.

#### Scenario: An omitted snapshot user is not implicitly removed

- **GIVEN** a whole-snapshot restore whose user list omits an existing user
- **WHEN** `upsertUsers` runs
- **THEN** the omitted user remains; only users present in the snapshot are
  upserted or created

#### Scenario: Explicit removal uses bounded guards and one idempotent delete

- **GIVEN** an administrator removes a user through the dedicated admin command
- **WHEN** removal runs
- **THEN** it performs only bounded reference checks and one `deleteMany` for
  that user id, never a loop over snapshot users

### Requirement: Organization read does not write on read

`organization.getOrganization` MUST read the singleton with `findUnique` and
MUST fail loudly when the row is absent. It MUST NOT create or upsert during
read; the canonical init migration provisions the baseline row and the seed
may update its product defaults, so a normal read — including the anonymous
landing path — is always read-only.

#### Scenario: Fresh canonical initialization provisions the singleton

- **WHEN** a fresh production database applies the canonical init migration
- **THEN** it contains the `Organization` row with id `singleton`, short name
  `Demo`, and full name `Example Software Department`
- **AND** applying the seed remains idempotent and may update that row

#### Scenario: Reading an existing organization performs no write

- **GIVEN** the organization row already exists
- **WHEN** `getOrganization` is called (e.g. from the anonymous landing path)
- **THEN** it returns the row via `findUnique` without performing a write

#### Scenario: Absent organization fails loudly

- **GIVEN** no organization row exists yet
- **WHEN** `getOrganization` is called
- **THEN** it fails with a missing-singleton error and performs no write

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

### Requirement: Product-group ownership loads in one batched query

The admin "products attached" editor MUST resolve the owning reporting group
(if any) for a set of products with a single batched query keyed on all
product IDs, not one `admin.listProductGroups` call per product. The number
of network requests issued when the editor opens MUST NOT scale with the
number of active products in the catalog.

#### Scenario: Opening the products-attached dialog issues one ownership query

- **GIVEN** a reporting group's edit dialog listing N active products
- **WHEN** the "Products attached" editor loads
- **THEN** exactly one `admin.listProductGroupOwnership` request is issued
  for all N product IDs, instead of N separate `admin.listProductGroups`
  requests

#### Scenario: Ownership updates after attach or detach

- **GIVEN** the batched ownership query has already loaded
- **WHEN** a product is attached to or detached from a group
- **THEN** the batched ownership cache is invalidated and refetched so the
  lock state ("Already attached to X") reflects the new edge, without
  reverting to per-product queries

### Requirement: Session-hydration organization read does not write on a cache miss

`hydrateSession`'s organization-hydration step MUST read the `Organization`
singleton with `findUnique` on a cache miss. A missing row MUST fail loudly;
hydration MUST NOT invent a default or write the singleton on the authenticated
request hot path, so a normal 5-second-TTL cache refresh does not take a write
lock on every concurrent cold request.

#### Scenario: Cache-miss read of an existing organization performs no write

- **GIVEN** the `Organization` singleton row already exists
- **AND** the 5-second TTL cache has expired
- **WHEN** an authenticated request triggers `hydrateOrganization`
- **THEN** it re-populates the cache via `findUnique` without performing a
  write

#### Scenario: Absent singleton row fails loudly

- **GIVEN** the `Organization` singleton row does not exist
- **WHEN** `hydrateOrganization` runs on a cache miss
- **THEN** it throws a descriptive missing-singleton error and performs no
  write

### Requirement: Weekly-report active deadline lookup runs alongside the other independent reads

`getWeeklyReport` MUST dispatch its active deadline `reminderRule.findFirst`
lookup concurrently with the `leadUsers` and `projects` queries (in the same
`Promise.all` batch) rather than awaiting it afterward as a separate round-trip.
The lookup depends only on the already-fetched `report.deadline` and its own
report/policy predicates.

#### Scenario: Active deadline lookup is part of the concurrent batch

- **GIVEN** a request that builds a weekly report
- **WHEN** the repository fetches `leadUsers`, `projects`, and the active
  deadline reminder rule
- **THEN** all three queries are dispatched concurrently and awaited
  together, not with the deadline lookup issued as a subsequent serial `await`

### Requirement: Published weekly-report reads use only the frozen snapshot

On a published report, `getWeeklyReport` MUST build the result exclusively from
the validated immutable `publishedSnapshot` and MUST NOT query live `Project`,
`GroupProduct`, or `StageAssignment` rows. This keeps published reads stable
after live records are archived, reassigned, or deleted. Cross-group audit
signals on published reads are derived from frozen snapshot data.

#### Scenario: Published branch performs no live project read

- **GIVEN** a request for a report whose `periodStatus` is `published`
- **WHEN** the repository builds the result
- **THEN** it reads the frozen snapshot and performs no live project,
  group-product, or stage-assignment query

#### Scenario: Live branch still fetches stageAssignments

- **GIVEN** a request for a report whose `periodStatus` is not `published`
- **WHEN** the repository queries `projects`
- **THEN** the query includes `stageAssignments`, as consumed by
  `buildPortfolioOverview`

### Requirement: Published search is bounded and GIN-backed

Published search MUST issue one database query over
`PublishedSearchDocument.searchTsv`, applying `plainto_tsquery`, the caller's
frozen group grants, included record types, and the requested result limit in
SQL. It MUST NOT load every published snapshot into application memory or
serialize the corpus back to PostgreSQL per request.

#### Scenario: Search work is bounded by the database query

- **GIVEN** any number of historical published reports
- **WHEN** a caller runs published search with limit N
- **THEN** PostgreSQL filters the stored GIN-indexed projection and returns at
  most N ordered rows
- **AND** the API does not load or reconstruct unrelated snapshot documents
