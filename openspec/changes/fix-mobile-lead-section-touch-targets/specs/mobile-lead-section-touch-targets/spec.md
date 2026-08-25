## Purpose

Ensure that leads can reliably operate section disclosure controls and sticky completion actions by touch on narrow viewports while retaining compact desktop geometry.

## ADDED Requirements

### Requirement: Lead-form section disclosures provide mobile-size targets

Every visible collapse or expand button for Current Week, Next Week, Risks & Blockers, and Decisions MUST render at least 44 px wide and 44 px high when the viewport is narrower than 48 rem. Each control MUST retain its accessible name and section disclosure behavior.

#### Scenario: Lead collapses or expands report sections on mobile

- **WHEN** a lead opens an editable report on a viewport narrower than 48 rem
- **THEN** each visible section disclosure button has a rendered width and height of at least 44 px
- **AND** activating it retains the existing expanded state, accessible name, and behavior

#### Scenario: Desktop section disclosures remain compact

- **WHEN** a lead opens an editable report on a viewport at least 48 rem wide
- **THEN** section disclosure buttons retain the established compact desktop geometry
- **AND** their order and behavior are unchanged

### Requirement: Sticky completion actions provide mobile-size targets

Every visible actionable button in the lead form's sticky completion rail MUST render at least 44 px wide and 44 px high when the viewport is narrower than 48 rem. Disabled and enabled states MUST retain their existing labels and behavior.

#### Scenario: Lead operates completion actions on mobile

- **WHEN** a lead opens an editable report on a viewport narrower than 48 rem
- **THEN** every visible Save, Add, and Submit action in the sticky completion rail has a rendered width and height of at least 44 px
- **AND** enabled, disabled, saving, and submission behavior remain unchanged

#### Scenario: Desktop completion rail remains compact

- **WHEN** a lead opens an editable report on a viewport at least 48 rem wide
- **THEN** completion actions retain the established compact desktop geometry
- **AND** their labels, order, and behavior are unchanged
