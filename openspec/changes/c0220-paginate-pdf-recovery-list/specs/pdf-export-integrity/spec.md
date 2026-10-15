## ADDED Requirements

### Requirement: The PDF recovery list is paginated with a continuation cursor

`admin.jobs.listPdfRecovery` SHALL accept an optional `limit` (1–200, default 50) and an optional `cursor`, and SHALL return `jobs` plus `nextCursor`. Rows
SHALL be ordered by `createdAt` ascending, then `jobId` ascending. The cursor
SHALL identify the last returned row by `{createdAt, jobId}`, and the next page
SHALL contain only rows strictly after it in that order. `nextCursor` SHALL be
null when the page holds fewer than `limit` rows. Every listed row SHALL remain
reachable by following `nextCursor`; the list SHALL NOT drop rows to fit a page.
The Head recovery panel SHALL load further pages on request and SHALL NOT
present a total count until the last page is loaded. Where another recovery
scenario says a row is listed, the row SHALL appear on the first page or on a
page reached by following `nextCursor`. A failed next-page load SHALL keep the
rows already loaded on screen.

#### Scenario: Rows beyond the first page stay reachable

- **GIVEN** 51 `failed` or `recovery_required` export rows
- **WHEN** a Head lists recovery rows without a cursor
- **THEN** the first 50 rows by `createdAt`, `jobId` are returned with a
  `nextCursor`
- **AND** listing with that cursor returns the 51st row and a null `nextCursor`

#### Scenario: A retried row does not shift later pages

- **GIVEN** a Head has loaded the first page
- **WHEN** a row on that page is retried and leaves the recovery set
- **THEN** listing with the earlier `nextCursor` still starts after the last
  row of the first page and skips no remaining row

#### Scenario: The limit is bounded

- **WHEN** a Head requests a `limit` above 200
- **THEN** the request is rejected by input validation
