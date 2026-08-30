# head-surface-parity Specification

## Purpose

Align head slides, dashboard, and report toolbar chrome with the shared lead/report vocabulary while removing redundant non-signal controls.

## Requirements

### Requirement: The Head Slide Deck Mirrors the Lead Toolbar Placement and Sheds Redundant Chrome

The head slide deck SHALL place its toolbar controls at the top as the lead deck does,
render no standalone "Group Status Slides" header band, and render no in-slide
`ReadinessStrip`. The carousel placement is unchanged; no slide data or status
semantics change.

#### Scenario: The redundant slides header is gone and controls stay on top

- **GIVEN** the head opens the slide deck
- **WHEN** it renders
- **THEN** there is no separate "Group Status Slides" header line duplicating the report context
- **AND** there is no in-slide `ReadinessStrip` (per-slide readiness reads from the carousel thumbnails)
- **AND** the toolbar controls sit at the top, mirroring the lead deck

### Requirement: The Head Dashboard Sheds Non-Signal Chrome While Keeping KPIs

The head dashboard SHALL slim the `ProductKpiCard` to a compact single-row strip that keeps
its KPIs (Submissions / Deadline / Risks & Blockers), render no duplicate `Activity24hCard`,
and keep the `LeadSummaryTable` within its container with no horizontal scroll at every width.

`ProductKpiCard` MUST NOT be deleted (the signal is kept, only compacted). The
`LeadSummaryTable` MUST stack as per-lead cards below the `lg` (1024px) breakpoint and MUST
engage its aligned multi-column grid only at and above `lg`, where the six count columns fit
the container — the grid's ~970px minimum overflows the narrower `md` container, so engaging
it at `md` reintroduces a horizontal scrollbar in the 768–1023px band. `BlockedAtRiskTable`
state correctness MUST be verified against the escalation/`at_risk` flagged-red roll-up, not
redesigned.

#### Scenario: ProductKpiCard is slimmed, not removed

- **GIVEN** the head dashboard
- **WHEN** it renders
- **THEN** the product KPIs (Submissions / Deadline / Risks & Blockers) are shown in a compact single-row strip
- **AND** the KPI signal is not removed

#### Scenario: The lead summary stacks without horizontal scroll in the tablet band

- **GIVEN** the head dashboard `LeadSummaryTable` at a tablet width (768–1023px)
- **WHEN** it renders
- **THEN** each lead renders as a stacked card whose counts wrap as a labeled-value list
- **AND** neither the card nor the page shows a horizontal scrollbar

#### Scenario: The lead summary aligns as a grid at desktop width without horizontal scroll

- **GIVEN** the head dashboard `LeadSummaryTable` at desktop width (≥1024px)
- **WHEN** it renders
- **THEN** the per-lead counts align on shared subgrid column rails
- **AND** the table fits inside its card with no horizontal scrollbar

### Requirement: The Head Report Toolbar Splits Document Actions From Context Controls and Drops Present

The head report toolbar SHALL group the document actions (Export-PDF, Publish) separately
from the context controls (period navigation, archived-period switch, slide scope,
view mode). The `ScopeToggle` (Product / Leads) is UNCHANGED — the shared
`SegmentedToggle` already gives lead and head one toolbar idiom, so no restyle is made.

#### Scenario: the toolbar keeps its action split

- **GIVEN** the head report toolbar
- **WHEN** it renders
- **THEN** the document actions (Export-PDF, Publish) sit apart from the context controls
- **AND** the ScopeToggle keeps its existing shared segmented style
