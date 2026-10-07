# Lead Report Health Pulse

## Purpose

Provide a compact, read-only view of current reporting-unit health within the
Lead Report, with contextual detail and no duplicate status-editing forms.

## Requirements

### Requirement: Lead Report MUST expose a problem-first health pulse

Canonical Lead Report MUST use one compact pulse near Status overview instead
of separate lower Product Status and Project Activities editing accordions.
The pulse MUST show affected units and concrete stage or activity locations,
ordered blocked, at risk, then missing status. Counts MUST identify current
reporting units as their denominator and exclude historical-only units.
Missing status MUST be counted independently, including partly unreported
products, and MUST NOT be presented as healthy coverage.

#### Scenario: A blocked product also has unreported stages

- **WHEN** a current product has a blocked stage and an unset stage
- **THEN** the unit contributes once to blocked and once to missing status
- **AND** both problem and missing-stage locations remain visible
- **AND** risk records and stages are not added to the unit denominator

#### Scenario: Activity health is independent

- **WHEN** an activity has a risk-backed severity
- **THEN** its pulse health uses the current section and canonical risk floor
- **AND** it does not raise the status of a linked product
- **AND** it does not display SDLC stages

### Requirement: Health inspection MUST be contextual and non-mutating

Pulse entries and overview unit names MUST open the same read-only inline
detail. Product detail MUST expose every applicable owned stage; available
risk causes, impact and mitigation MUST be readable. Historical detail MUST
be labelled and MUST NOT attach unrelated current risks. Inspection MUST NOT
invoke draft, status, submit or outcome mutations and MUST preserve pending
composer input. Opening MUST focus the detail; closing MUST return focus to
the opener or an available overview fallback.

#### Scenario: Inspection during authoring

- **WHEN** a lead opens and closes health detail while an update is unfinished
- **THEN** the input and save state remain unchanged
- **AND** no mutation is invoked by inspection
- **AND** keyboard focus returns to the initiating control

#### Scenario: Read-only report

- **WHEN** the report is not editable
- **THEN** health inspection remains available without status controls

### Requirement: Pulse MUST preserve report parity and responsive readability

Health MUST reuse canonical status vocabulary and presentation tokens. Risks,
Decisions, reviewer feedback and submit guidance MUST remain available through
the existing draft coordinator. The timeline MUST remain usable at 390px and
native 200% browser zoom, without horizontal overflow or clipped controls.

#### Scenario: Narrow or enlarged report

- **WHEN** the report is viewed at 390px or native 200% browser zoom
- **THEN** pulse locations and health details remain readable
- **AND** close controls and pending report input remain reachable

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

### Requirement: Unit inspection MUST stay contextual and non-mutating

The pulse and each overview unit name MUST open the same read-only health detail
for that unit in the Report overview. Product detail MUST expose every applicable
stage and its status; activity detail MUST expose activity health without SDLC
stages. Available risk causes, impact and mitigation MUST be readable. Inspection
MUST preserve current report navigation, pending composer input and save state,
and MUST NOT invoke a draft, status, submit or outcome mutation.

#### Scenario: A lead inspects a unit while editing an update

- **WHEN** the lead opens and closes that unit's health detail
- **THEN** the unfinished update remains available unchanged
- **AND** no data mutation is sent by inspection
- **AND** keyboard focus reaches the detail and returns to its opener on close

#### Scenario: A submitted report is inspected

- **WHEN** the lead opens health detail in a read-only report
- **THEN** the detail remains available without edit controls
- **AND** historical-only units are not counted as current problems

### Requirement: Pulse presentation MUST preserve report readability and parity

The pulse MUST reuse canonical status vocabulary and tokens, preserve the
existing timeline and avoid duplicate lower status forms. Risk and Decision
authoring, review feedback and submit guidance MUST remain reachable through
the current draft coordinator. Pulse and detail MUST work with keyboard input,
390px layout and native 200% browser zoom without hidden required information,
horizontal overflow or clipped controls.

#### Scenario: The report is enlarged or narrowed

- **WHEN** the report is viewed at 390px or native 200% browser zoom
- **THEN** pulse content, unit detail and close controls remain readable and reachable
- **AND** the prior/current/next report and its input remain usable
