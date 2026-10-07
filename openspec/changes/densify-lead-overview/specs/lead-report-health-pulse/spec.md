# Spec Delta

## MODIFIED Requirements

### Requirement: Lead Report MUST expose one compact read-only health pulse

Canonical Lead Report MUST replace its lower Product Status and Project Activities status-editing accordions with one compact health pulse near the weekly overview. By default the pulse MUST render as one summary line that names the counts of blocked, at-risk and missing-status units with their denominators, and MUST expand on demand to identify affected reporting units and concrete stage or activity locations before healthy detail. While the disclosure is closed, only the summary line MUST be mounted; attention entries and their inspection controls MUST render only after it opens. Closing the disclosure MUST remove those entries from the reading and keyboard order. It MUST distinguish blocked, at-risk and missing-status information without implying that missing data is healthy. Its totals MUST name their denominator and count each current unit once per stated category, without including historical-only units.

#### Scenario: Problems exist across a product and an activity

- **WHEN** a product has a blocked stage and an activity is at risk
- **THEN** the summary line states one blocked and one at-risk unit
- **AND** expanding the pulse shows both units and their problem locations
- **AND** the activity signal does not raise any linked product's health
- **AND** the pulse offers no status-changing controls

#### Scenario: Some stages have not been reported

- **WHEN** a product has one green stage and other unset stages
- **THEN** missing stage coverage remains visible as missing information in the summary and in the expanded view
- **AND** the pulse does not claim that every stage is healthy

#### Scenario: Nothing is wrong

- **WHEN** no unit is blocked, at risk or missing a status
- **THEN** the summary line states that all current units are reported healthy with their count

#### Scenario: The health disclosure is opened and closed

- **WHEN** the lead opens the Report health disclosure
- **THEN** affected units and their inspection actions become available
- **AND** closing it removes the attention entries and their controls while preserving the summary and draft
