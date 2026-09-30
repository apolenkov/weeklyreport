## ADDED Requirements

### Requirement: Trends tables expose the latest information first

At `/reports/trends`, Traffic-light history and Lead submissions MUST render
period columns newest first, immediately after the sticky project or lead
identity column. Period comparison MUST place Latest status immediately after
Project, followed by Previous status and the existing risk comparison columns.
The identity column MUST remain compact enough that the latest header and
complete status or submission cell are visible at 375 CSS pixels before
scrolling. Names MUST wrap, and internal table scrolling MUST have a visible
cue while preserving the named keyboard-focusable region.

This ordering MUST change presentation only. Traffic-light history MUST map
each displayed period to its original status index, and latest change markers
MUST still compare that period with its preceding chronological period. Lead
submissions headers and cells MUST use the same reversed render order without
mutating query results. Query windows, summaries, risk-change direction,
aggregation, API contracts, and original data order MUST remain unchanged.

#### Scenario: A mobile reader opens populated Trends

- **WHEN** Traffic-light history or Lead submissions contains several periods at 375 CSS pixels
- **THEN** its first period header is the newest and the corresponding full cell is visible beside the name
- **AND** a visible cue explains how to reach the remaining columns

#### Scenario: Display order changes without changing a transition

- **GIVEN** a project's earlier and latest periods have different known statuses
- **WHEN** Traffic-light history renders newest first
- **THEN** each badge still belongs to its original period
- **AND** the latest marker retains its original Recovered or Slipped meaning

#### Scenario: Comparison shows latest status beside Project

- **WHEN** Period comparison renders its existing previous/latest pair
- **THEN** Latest status precedes Previous status with values aligned to those headers
- **AND** risk change remains latest minus previous

#### Scenario: A table has one or no period

- **WHEN** Traffic-light history or Lead submissions has one period or no rows
- **THEN** a single period retains its corresponding values without a fabricated previous-period marker
- **AND** the existing explicit empty state remains when there are no rows
