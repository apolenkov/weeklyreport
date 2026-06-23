# head-toolbar-semantics delta — head slides lead-deck parity

## MODIFIED Requirements

### Requirement: Header utility actions carry visible text labels

Head-report-header utility links MUST render a visible text label next to
their icon ("Present", "Print", "Open focused report") — icon-only rendering
is not allowed for the actions that navigate to a distinct surface (the
`/head/report/[id]/present` link, the `/print/[reportId]` link, and the
slides-mode "Open focused report" drill-into-a-lead link in
`head-report-shell.tsx`). Labels MUST honestly name the surface: the
browser-print template is labeled "Print", not "Export PDF" or "Print PDF".

In slides mode the "Open focused report" action MUST sit on the report
toolbar / slides-mode header line (beside the Export-PDF document action),
NOT inside the deck body — matching how the lead deck keeps its toolbar
actions on the header line (S3). The action targets the active slide's lead
focused report; when it cannot resolve a target (no active slide / no active
period) it MUST NOT render.

#### Scenario: utility links render

- **WHEN** the head report header renders the presentation and print
  links
- **THEN** each shows its icon plus a visible text label
- **AND** the print link is labeled "Print" (distinct from the
  publish-gated "Export PDF" action)

#### Scenario: the slides-mode Open focused report sits on the header line

- **WHEN** the head views the report in `?mode=slides` with a resolvable
  active slide
- **THEN** the "Open focused report" action renders on the report toolbar /
  header line beside the Export-PDF action, not inside the deck body
- **AND** it carries a visible "Open focused report" label

### Requirement: Deferred placeholders render visually subordinate

An inert deferred-feature placeholder MUST render visually subordinate to real actions — compact — and MUST lead its control group: the head report header, or the right-aligned view-control group of the report toolbar's context bar, in BOTH form mode and slides mode.

Today this placeholder is `AgentReviewComingSoon`
(`apps/web/src/components/report-shell/agent-review-coming-soon.tsx`). The inert
ComingSoonBadge pattern (aria-disabled, no click handler, tooltip) MUST be
preserved. In the report toolbar's context bar the controls form two clusters —
period navigation (and the show-archived filter) anchored left, and the
right-aligned view-control group (Agent review, scope, view mode, expand-all)
pushed right by a spacer. The placeholder is compact and leads that right-aligned
view-control group; it is NOT required to be the first element of the whole bar
(the period navigator is).

In slides mode the placeholder MUST live in this same context-control
(period-controls) row, NOT in the slide header (S6). The slides surface MUST
mount exactly one Agent-review placeholder — the toolbar context-row one — so
removing the former slide-header slot means the slides toolbar context row now
carries the placeholder just as form mode does, with no double-mount.

#### Scenario: the context bar renders a deferred placeholder

- **WHEN** the report toolbar's context bar renders the Agent review placeholder
  alongside the right-aligned view controls (scope, view mode)
- **THEN** the placeholder is compact (smaller than the real actions) and is the
  first element of the right-aligned view-control group, following the
  left-anchored period navigation
- **AND** it remains aria-disabled with the ComingSoonBadge tooltip

#### Scenario: slides mode hosts the Agent review placeholder in the toolbar

- **WHEN** the head views the report in `?mode=slides`
- **THEN** the Agent review placeholder renders in the toolbar context-control
  (period-controls) row, leading the right-aligned view-control group
- **AND** it does not render in the slide header
- **AND** the slides surface mounts exactly one Agent-review placeholder
