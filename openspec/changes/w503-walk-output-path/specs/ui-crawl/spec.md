## ADDED Requirements

### Requirement: Tester-kit output overrides use one destination

The tester-kit `walk.sh` runner MUST accept `--out directory` and
`--out=directory` with the same non-empty destination. Quick crawl output, full
state output and the final full-run merge MUST derive from that destination.

#### Scenario: Quick walk uses an explicit destination

- **WHEN** a quick walk receives either output argument form
- **THEN** the crawler receives the requested destination exactly once

#### Scenario: Full walk uses an explicit destination

- **WHEN** a full walk receives either output argument form
- **THEN** state outputs are children of the requested destination
- **AND** the final merge reads that same destination

#### Scenario: Equals-form destination is empty

- **WHEN** the runner receives `--out=`
- **THEN** it rejects the argument before starting a crawl
