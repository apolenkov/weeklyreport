## MODIFIED Requirements

### Requirement: Lead report MUST expose one shared authoring chrome across Overview and Edit

The no-query lead report route MUST continue to open Overview. Overview and
Edit MUST render the same canonical report identity, autosave, Fill From, Save,
quick-add, Submit, period navigation, visibility, and mode controls whenever
the same action is available for the current section. These controls MUST call
the existing editor draft and write actions; Overview MUST NOT introduce a
second action implementation or persistence path. Detailed Product stages,
Activity status, risks, decisions, and completion guidance MAY remain in Edit.

#### Scenario: an editable lead opens the default route

- **WHEN** the lead opens `/lead/report/:reportId` without a mode query
- **THEN** Overview is active and the canonical document/context actions render
- **AND** Save, quick add, Submit, period, visibility, and mode actions have the
  same enabled state and handlers as Edit

#### Scenario: an Overview action opens a canonical dialog

- **WHEN** the lead activates quick add, Fill From, Submit, or reopen/revoke
- **THEN** the existing lead dialog host handles the action
- **AND** no Overview-specific mutation endpoint or draft store is used

### Requirement: Overview status MUST prioritize actionable health

Overview MUST derive every unit's canonical health exactly as before, but its
summary MUST render a visible health badge only for `at-risk` and `blocked`.
`on-track` and `empty` MUST remain valid model values and MUST NOT be relabelled
as a different health; they are visually omitted so Product/Activity identity
and ownership metadata carry the neutral state.

#### Scenario: a unit has no actionable health

- **WHEN** a unit is `on-track` or `empty`
- **THEN** no unit health badge is rendered
- **AND** its name, ownership metadata, linked Products, and content remain
  available

#### Scenario: a unit requires attention

- **WHEN** a unit is `at-risk` or `blocked`
- **THEN** the canonical label, tone, and dot are rendered once

### Requirement: Overview MUST use stable equal matrix geometry

At desktop widths of at least 80 rem, the reporting-unit identity column and
the three temporal columns MUST use four equal flexible tracks. Every cell in a
unit row MUST share that row's computed height. Within an item, description and
tag MUST own the flexible region while continuity and Edit occupy one stable
trailing rail; text growth MUST wrap without moving actions into a separate
column or causing document overflow.

#### Scenario: desktop rows contain different amounts of text

- **WHEN** Overview renders at 1280x900 or 1728x962
- **THEN** all four column boundaries align across every reporting unit
- **AND** each cell within a row has equal height
- **AND** the document has no horizontal overflow

#### Scenario: an editable unplanned item wraps

- **WHEN** an unplanned Current item has a multi-line description
- **THEN** `Unplanned` and `Edit` remain together in the trailing action rail
- **AND** the description and tag remain readable in the flexible region
