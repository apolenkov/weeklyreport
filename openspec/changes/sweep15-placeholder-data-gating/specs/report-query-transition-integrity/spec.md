## ADDED Requirements

### Requirement: Report identity changes never reuse another report as placeholder data

The web client MUST NOT render cached content or report-scoped mutation controls from one report id after navigation has selected a different report id whose query is still pending or fetching its first data.

#### Scenario: Period B remains pending instead of showing period A

- **GIVEN** period A is cached and the user navigates to period B
- **WHEN** the report query for period B has not returned data
- **THEN** the head, viewer, lead, print, and slide report consumers render their pending state
- **AND** no content labeled as period B comes from period A

#### Scenario: Mutations cannot target placeholder content

- **GIVEN** a report surface exposes report-scoped actions after data loads
- **WHEN** its route has changed to another report id whose first response is pending
- **THEN** publish, reopen, save, submit, revoke, review, and export actions tied to the unresolved report body are not actionable

### Requirement: Previous data retention is an explicit safe-query opt-in

The web query configuration MUST keep `keepPreviousData` out of global defaults and MUST apply it only at locally audited list or pagination queries whose retained rows cannot be presented as a different report identity or enable a mutation against one.

#### Scenario: A safe list query retains rows during pagination

- **WHEN** an identity-stable list query explicitly opts into `keepPreviousData`
- **THEN** its prior rows may remain visible while the next list response loads
- **AND** the query site documents and tests why the retained rows are safe

#### Scenario: A new report query inherits safe defaults

- **WHEN** a new report-by-id query is added without local placeholder configuration
- **THEN** changing its report id produces a pending state rather than previous-report placeholder data
