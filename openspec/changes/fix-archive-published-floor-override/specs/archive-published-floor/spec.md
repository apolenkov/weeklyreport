## ADDED Requirements

### Requirement: Published-Only Floor Takes Precedence Over Caller Filters

Every archive read query MUST compose the published-only status floor
(`status: "published"`, `archived: true`) into its Prisma `where` clause
such that the floor's values win over any caller-supplied filter, not the
reverse. A caller-supplied filter MAY narrow the result set further (e.g.
an explicit `status: "published"` is a no-op against the floor) but MUST
NOT be able to widen it to include non-published or non-archived reports,
regardless of what the filter object contains.

#### Scenario: Mis-built filter cannot widen the archive list

- **WHEN** `listArchiveReports` is called with a filter of `{ status: "draft" }`
- **THEN** the resulting query still only matches reports with `status: "published"` and `archived: true`
- **AND** no draft report is returned

#### Scenario: Mis-built filter cannot widen a single archive read

- **WHEN** `getArchiveReport` is called for a report id with a filter of `{ status: "draft" }`
- **AND** that report is not published
- **THEN** the query returns no result for that id

#### Scenario: A correctly-built filter still narrows as intended

- **WHEN** the archive service's own `buildArchiveReadFilter` produces `{ status: "published" }` or `{}`
- **THEN** the query behavior is identical to before this change (the floor and the filter agree, so composition order is unobservable)
