## ADDED Requirements

### Requirement: Agent-Review Placeholder Covers Every On-Screen Report Surface

The agent-review deferred placeholder MUST render exactly once on every on-screen surface that shows a reader assembled report content, so coverage is consistent across slides, the published viewer, the presentation views, the lead self-preview, and the head report shell. The placeholder MUST be the `AgentReviewComingSoon` component from `apps/web/src/components/report-shell/agent-review-coming-soon.tsx` wrapping a `ComingSoonBadge`, and MUST NOT be hidden behind a runtime feature flag.

#### Scenario: Published report viewer shows the placeholder

- **WHEN** a viewer or head opens `/reports/[reportId]` to read an assembled report
- **THEN** the published-viewer header at `apps/web/src/app/(app)/reports/[reportId]/page.tsx` renders one `AgentReviewComingSoon` control with its coming-soon tooltip

#### Scenario: Presentation surfaces show the placeholder

- **WHEN** a user opens a presentation view at `/head/report/[reportId]/present` or `/reports/[reportId]/present`
- **THEN** each presentation page header renders one `AgentReviewComingSoon` control

#### Scenario: Lead self-preview shows the placeholder

- **WHEN** a lead opens `/lead/report/[reportId]/preview` to read their own section as assembled
- **THEN** the preview page header at `apps/web/src/app/(app)/lead/report/[reportId]/preview/page.tsx` renders one `AgentReviewComingSoon` control

#### Scenario: Slides and head shell keep their existing placeholder

- **WHEN** a user views the lead slides, the head slide deck, or the head report shell
- **THEN** each surface still renders exactly one `AgentReviewComingSoon` control, with no surface rendering two
- **AND** the head report shell toolbar mounts the control in form mode only, because in slides mode the head slide article (`apps/web/src/components/slides/status-slide-deck.tsx`) already carries the surface's single placeholder

### Requirement: Agent-Review Placeholder Is Absent From Print And List Surfaces

The agent-review placeholder MUST NOT render on the print/PDF template or on list-only surfaces that enumerate reports rather than showing one report's content. The print template is a paper artifact where a hover-only "coming soon" tooltip cannot function, and history/archive lists have no single-report anchor for the control.

#### Scenario: Print/PDF template omits the placeholder

- **WHEN** the print template at `apps/web/src/app/print/[reportId]/page.tsx` renders for browser print or PDF export
- **THEN** no `AgentReviewComingSoon` control appears in the printed output

#### Scenario: History and archive lists omit the placeholder

- **WHEN** a user opens a report-listing surface such as `/lead/history`, `/head/history`, or the reports archive tab
- **THEN** no `AgentReviewComingSoon` control appears, because these surfaces list reports rather than render one report's content

### Requirement: Agent-Review Placeholder Stays Inert And String-Stable

The agent-review placeholder MUST remain inert wherever it is mounted, exposing no enabled action, introducing no new color token, and adding no new user-facing string beyond what `AgentReviewComingSoon` already renders. The mounted control MUST keep `aria-disabled="true"` and the existing English copy.

#### Scenario: Mounted placeholder exposes no working action

- **WHEN** a user activates the `AgentReviewComingSoon` control on any surface
- **THEN** nothing happens beyond showing the coming-soon tooltip, and the control reports `aria-disabled="true"`

#### Scenario: Compact variant is allowed in tight header rows

- **WHEN** a header row groups several pill controls at a reduced height
- **THEN** the placeholder MAY be mounted with the `compact` prop so it sits below the cluster's interactive height, consistent with `ui-control-density`
