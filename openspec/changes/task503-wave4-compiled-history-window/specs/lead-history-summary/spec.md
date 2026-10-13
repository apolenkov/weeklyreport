## ADDED Requirements

### Requirement: Compiled history exposes a bounded latest-period window

`reports.compiledHistory` MUST return at most the latest 100 authorized periods and a mandatory boolean `truncated`. It MUST use the current role, scope and `includeArchive` filter and deterministic periodStart/publishedAt/id descending order. A hidden probe period MUST NOT undergo snapshot validation. Personal `reports.myHistory` MUST retain its cursor contract.

#### Scenario: The authorized list has 101 periods

- **WHEN** the current history filter matches 101 periods
- **THEN** the response contains the latest 100 and `truncated: true`
- **AND** an invalid snapshot on the hidden 101st period does not fail the response

#### Scenario: The authorized list has at most 100 periods

- **WHEN** the current history filter matches exactly 100 or fewer periods
- **THEN** `truncated` is false
- **AND** foreign scopes do not affect the flag or returned entries

### Requirement: Compiled history archive count describes authorized archived total

`reports.compiledHistory.archiveCount` MUST remain the total archived published-period count under the session's existing scope and Viewer publication filter. It MUST NOT become the number of visible rows or all entries and MUST NOT determine `truncated`.

#### Scenario: Archive scope is excluded

- **GIVEN** 101 archived periods match the session and no unarchived period matches
- **WHEN** compiled history is requested with `includeArchive: false`
- **THEN** entries is empty, archiveCount is 101, and truncated is false

### Requirement: Compiled history truncation is visible to readers

The `/reports` compiled History panel and Head/Viewer period navigation MUST disclose "Showing the latest 100 periods." only when their displayed compiled result has `truncated: true`. The disclosure MUST remain distinct from history load errors and MUST NOT claim access to the complete older history.

#### Scenario: Reader receives a truncated history window

- **WHEN** a Head or Viewer receives a truncated compiled history result
- **THEN** the corresponding History or period navigation surface shows the latest-100 disclosure

#### Scenario: Personal or complete history is displayed

- **WHEN** a Lead displays personal history or compiled history has `truncated: false`
- **THEN** no latest-100 disclosure is shown
