## ADDED Requirements

### Requirement: The Head Slide Deck Mirrors the Lead Toolbar Placement and Sheds Redundant Chrome

The head slide deck SHALL place its toolbar controls at the top as the lead deck does,
remove the redundant "Group Status Slides" header line, move the Agent-review control into
the period-navigation row, and either clarify or remove the `ReadinessStrip`.

The carousel placement is unchanged (confirmed correct). These are presentation parity and
declutter changes; no slide data or status semantics change.

#### Scenario: The redundant slides header is gone and controls are on top

- **GIVEN** the head opens the slide deck
- **WHEN** it renders
- **THEN** there is no separate "Group Status Slides" header line duplicating the report context
- **AND** the toolbar controls sit at the top, mirroring the lead deck
- **AND** the Agent-review control is in the period-navigation row

### Requirement: The Head Dashboard Sheds Non-Signal Chrome While Keeping KPIs

The head dashboard SHALL slim the `ProductKpiCard` to a compact single-row strip that keeps
its KPIs (Submissions / Deadline / Risks & Blockers), trim the low-value `Activity24hCard`,
and fix the `LeadSummaryTable` styling so no unexpected horizontal scroll appears.

`ProductKpiCard` MUST NOT be deleted (the signal is kept, only compacted). `BlockedAtRiskTable`
state correctness MUST be verified against the escalation/`at_risk` flagged-red roll-up, not
redesigned.

#### Scenario: ProductKpiCard is slimmed, not removed

- **GIVEN** the head dashboard
- **WHEN** it renders
- **THEN** the product KPIs (Submissions / Deadline / Risks & Blockers) are shown in a compact single-row strip
- **AND** the KPI signal is not removed

#### Scenario: The lead summary does not scroll horizontally

- **GIVEN** the head dashboard `LeadSummaryTable`
- **WHEN** it renders
- **THEN** its styling fits without an unexpected horizontal scroll

### Requirement: The Head Report Toolbar Mirrors the Lead Status Row and Drops Present

The head report toolbar SHALL place publish / request-all-reopen / Agent-review / Edit like
the lead's status row (top-left of the logo) and SHALL remove the "Present" button, which the
slides mode supersedes.

The `ScopeToggle` (Product / Leads) is UNCHANGED — the shared `SegmentedToggle` already gives
lead and head one toolbar idiom, so no restyle is made.

#### Scenario: Present is removed and controls match the lead row

- **GIVEN** the head report toolbar
- **WHEN** it renders
- **THEN** the "Present" button is absent (slides mode covers presentation)
- **AND** publish / request-all-reopen / Agent-review / Edit sit where the lead's status row places them
- **AND** the ScopeToggle keeps its existing shared segmented style
