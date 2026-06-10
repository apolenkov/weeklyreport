## Purpose

The 2026-06-10 toolbar walk-through (`unify-head-toolbar-controls`, research
memo `memos/toolbar-critique-synthesis.md`) found the head Status Report
header had drifted into two segmented-control styles, icon-only actions
nobody could decode, an oversized inert placeholder, and the word "Publish"
on two unrelated controls. This capability fixes the durable labeling and
grouping properties of that header so the confusion does not regrow. It
governs naming/grouping semantics, not a code module.

## Requirements

### Requirement: Segmented toggles in the head report header share one visual family

The segmented controls in the head report header (`ScopeToggle` in
`apps/web/src/components/report-shell/scope-toggle.tsx` and
`ViewModeToggle` in `apps/web/src/components/report-shell/view-mode-toggle.tsx`,
composed by `apps/web/src/components/head/head-report-shell.tsx`) MUST
render as one visual family: the same active-fill token
(`--color-starbucks-accent`), the same font size tier (`text-sm`
semibold), and the same pill shape. Group separation MUST be carried by
the wrapper border/spacing, not by divergent control styling. A new
segmented control added to this header MUST adopt the same family.

#### Scenario: the header renders both toggles

- **WHEN** the head report header renders the scope toggle and the
  view-mode toggle together
- **THEN** both use the same active-fill token, font size, and pill shape
- **AND** the two groups remain visually separable via wrapper
  border/spacing

### Requirement: Header utility actions carry visible text labels

Utility actions in the head report header that navigate to a distinct
surface (the `/head/report/[id]/present` link and the `/print/[reportId]`
link in `head-report-shell.tsx`) MUST render a visible text label next to
their icon ("Present", "Print") — icon-only rendering is not allowed for
these actions. Labels MUST honestly name the surface: the browser-print
template is labeled "Print", not "Export PDF" or "Print PDF".

#### Scenario: utility links render

- **WHEN** the head report header renders the presentation and print
  links
- **THEN** each shows its icon plus a visible text label
- **AND** the print link is labeled "Print" (distinct from the
  publish-gated "Export PDF" action)

### Requirement: The word "Publish" appears on exactly one header control

Across both header rows of the head report surface, exactly one control —
the publish action (`PublishLockButton`) — MAY carry the word "Publish"
in its visible label. Precondition states of other controls (such as
`ExportPdfButton` in `apps/web/src/components/weekly-report/export-pdf-button.tsx`
while the period is unpublished) MUST be conveyed via the disabled state
plus a `title`/sr-only hint, NOT via a compound label containing
"Publish".

#### Scenario: unpublished period renders the export button

- **WHEN** the period status is `open` and the export button renders
  disabled
- **THEN** its visible label reads "Export PDF"
- **AND** the publish precondition is available via `title` and the
  sr-only hint
- **AND** only the publish action's label contains the word "Publish"

### Requirement: Deferred placeholders render visually subordinate

An inert deferred-feature placeholder in the head report header (today:
`AgentReviewComingSoon` in
`apps/web/src/components/report-shell/agent-review-coming-soon.tsx`) MUST
render visually subordinate to real actions — compact size — and MUST be
positioned at the trailing edge of its control group, after real actions.
The inert ComingSoonBadge pattern (aria-disabled, no click handler,
tooltip) MUST be preserved.

#### Scenario: the header renders a deferred placeholder

- **WHEN** the head report header renders the Agent review placeholder
  alongside real utility actions
- **THEN** the placeholder is compact (smaller than the real actions) and
  is the last element of the group
- **AND** it remains aria-disabled with the ComingSoonBadge tooltip
