## MODIFIED Requirements

### Requirement: Agent-Review Placeholder Covers Every On-Screen Report Surface

The agent-review deferred placeholder MUST render exactly once on every on-screen surface that shows a reader assembled report content, so coverage is consistent across slides, the published viewer, the lead self-preview, and the head report shell. The standalone `/present` routes are excluded because they 308-redirect to slides mode (see `report-routing`) and no longer render their own header. The placeholder MUST be the `AgentReviewComingSoon` component from `apps/web/src/components/report-shell/agent-review-coming-soon.tsx` wrapping a `ComingSoonBadge`, and MUST NOT be hidden behind a runtime feature flag.

#### Scenario: Published report viewer shows the placeholder

- **WHEN** a viewer or head opens `/reports/[reportId]` to read an assembled report
- **THEN** the published-viewer header at `apps/web/src/app/(app)/reports/[reportId]/page.tsx` renders one `AgentReviewComingSoon` control with its coming-soon tooltip

#### Scenario: Lead self-preview shows the placeholder

- **WHEN** a lead opens `/lead/report/[reportId]/preview` to read their own section as assembled
- **THEN** the preview page header at `apps/web/src/app/(app)/lead/report/[reportId]/preview/page.tsx` renders one `AgentReviewComingSoon` control

#### Scenario: Slides and head shell keep their existing placeholder

- **WHEN** a user views the lead slides, the head slide deck, or the head report shell
- **THEN** each surface still renders exactly one `AgentReviewComingSoon` control, with no surface rendering two
- **AND** the head report shell toolbar mounts the control in form mode only, because in slides mode the head slide article (`apps/web/src/components/slides/status-slide-deck.tsx`) already carries the surface's single placeholder

## ADDED Requirements

### Requirement: Lead Export-PDF Is a UI-Deferred ComingSoon Control

The lead Export-PDF control MUST be a UI-deferred `ComingSoonBadge`
control: a 32×32 inert icon control matching the `lead-toolbar-presentation`
sizing, never wired to any backend call. It MUST NOT invoke
`pdfExport.request` or any other backend procedure. A `TODO(lead-pdf-export)`
marker MUST sit at the control's activation point. Because nothing
reaches a backend path, no loud backend stub is added for this control.

#### Scenario: the lead toolbar renders the deferred Export-PDF control

- **WHEN** a lead opens their report toolbar
- **THEN** a 32×32 inert Export-PDF icon control wrapped in
  `ComingSoonBadge` renders
- **AND** activating it does nothing beyond showing the coming-soon
  tooltip and never calls a backend procedure

#### Scenario: the activation point carries the deferred marker

- **WHEN** the lead Export-PDF control is defined in source
- **THEN** a `TODO(lead-pdf-export)` marker exists at its activation
  point
- **AND** no loud backend stub is wired, because nothing reaches one
