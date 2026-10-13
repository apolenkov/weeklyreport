## ADDED Requirements

### Requirement: Assembled review preview follows authenticated group scope

`review.assembledReport` MUST return only sections within the authenticated caller's group scope. Its `portfolioOverview` MUST be derived solely from those visible sections with distinct products counted once. A missing session MUST fail closed. Internal publication assembly MUST retain all groups, and Admin preview MUST retain full visibility.

#### Scenario: Head previews a multi-group editable report

- **GIVEN** an editable report containing group-A and group-B sections
- **WHEN** a head scoped to group A requests `review.assembledReport`
- **THEN** only group-A sections are returned
- **AND** portfolio status and totals reflect only group-A sections

#### Scenario: Groupless head previews an editable report

- **WHEN** an authenticated head with no allowed group requests the assembled preview
- **THEN** no sections are returned
- **AND** portfolio totals are zero

#### Scenario: Admin previews an editable report

- **WHEN** an authenticated admin requests the assembled preview of a multi-group report
- **THEN** all sections and their full portfolio overview are returned

#### Scenario: Preview is called without a session

- **WHEN** a preview read is invoked without an authenticated session
- **THEN** it fails before any unrestricted query can run

#### Scenario: Internal publication assembles the same report

- **WHEN** internal publication assembles the multi-group report
- **THEN** its snapshot retains all sections and the full portfolio overview
