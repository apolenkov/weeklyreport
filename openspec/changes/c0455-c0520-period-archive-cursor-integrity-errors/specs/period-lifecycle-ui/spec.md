## ADDED Requirements

### Requirement: The admin period archive is paginated with a continuation cursor

`admin.listPeriodsByState` SHALL accept an optional `limit` (1–200, default 50)
and an optional `cursor`, and SHALL return `periods` plus `nextCursor`. Rows
SHALL be ordered by `periodStart` descending, then `id` descending. The cursor
SHALL identify the last returned row by `{periodStart, id}`. The next page SHALL
contain only rows strictly after that row in this order. `nextCursor` SHALL be
null when the page holds fewer than `limit` rows. Every archived period SHALL
remain reachable by following `nextCursor`. The Periods tab archive section
SHALL load further pages on request and SHALL keep rows already loaded when a
next-page load fails.

#### Scenario: Archived periods beyond the first page stay reachable

- **GIVEN** 51 archived periods
- **WHEN** an admin lists the archive bucket without a cursor
- **THEN** the 50 newest periods are returned with a `nextCursor`
- **AND** listing with that cursor returns the oldest period and a null
  `nextCursor`

#### Scenario: An unarchived period does not shift later pages

- **GIVEN** an admin has loaded the first archive page
- **WHEN** a period on that page is unarchived
- **THEN** listing with the earlier `nextCursor` still starts after the last row
  of the first page and skips no remaining archived period

#### Scenario: The archive section loads more on request

- **GIVEN** the archive section is open and the first page has a `nextCursor`
- **WHEN** the admin activates "Load more"
- **THEN** the next page's periods are shown after the loaded ones

#### Scenario: The limit is bounded

- **WHEN** an admin requests a `limit` above 200
- **THEN** the request is rejected by input validation
