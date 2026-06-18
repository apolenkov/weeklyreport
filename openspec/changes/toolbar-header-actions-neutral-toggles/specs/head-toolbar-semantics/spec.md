## MODIFIED Requirements

### Requirement: Segmented toggles in the head report header share one visual family

The segmented controls MUST render as one neutral visual family wherever they
sit — the head report header or the report toolbar's context-control bar — using a
neutral active-selection fill, not the brand accent.

`ScopeToggle` (`apps/web/src/components/report-shell/scope-toggle.tsx`),
`ViewModeToggle` (`apps/web/src/components/report-shell/view-mode-toggle.tsx`),
and `RecordVisibilityToggle` (the lead Mine only/Everyone control in
`apps/web/src/components/lead/lead-form.tsx`) MUST compose one shared
presentational primitive so they are visually identical: the same neutral active
fill (`--color-foreground`, white active text), the same inactive treatment (a
solid `--color-surface-empty` track with `--color-muted-foreground` text), the
same neutral border, the same font size tier (`text-sm` semibold), the same pill
shape, and the same per-segment minimum width. Brand green (`--color-starbucks-accent`)
MUST NOT be used as the toggle active fill — green is reserved for header-line
forward actions (Submit Section, Publish & Lock). Group separation MUST be
carried by wrapper border/spacing, not by divergent control styling. A new
segmented control MUST adopt the same family. The toggles must compose the shared
primitive for their chrome while keeping their own mechanics: `ViewModeToggle`
stays `<Link>` URL navigation, `ScopeToggle` stays a `radiogroup`, and
`RecordVisibilityToggle` stays `aria-pressed` two-state buttons.

#### Scenario: the toggles render as one neutral family

- **WHEN** the report toolbar renders the scope toggle, the view-mode toggle, and
  (on the lead surface) the Mine/Everyone visibility toggle
- **THEN** all use the neutral foreground active-fill token, the same font size,
  and the same pill shape
- **AND** the toggles are visually identical, separated only by wrapper spacing
- **AND** none uses the brand-accent token as its active fill

#### Scenario: the inactive segment shows no cream-frame tint

- **WHEN** a segmented toggle renders an inactive segment inside the bordered
  context bar
- **THEN** the inactive segment sits on the defined `--color-surface-empty` track,
  not an undefined `--color-surface` value that lets the toolbar frame show
  through

### Requirement: Deferred placeholders render visually subordinate

An inert deferred-feature placeholder MUST render visually subordinate to real actions — compact — and MUST be positioned at the leading edge of its control group, whether that group is the head report header or the report toolbar's context-control bar.

Today this placeholder is `AgentReviewComingSoon`
(`apps/web/src/components/report-shell/agent-review-coming-soon.tsx`). The inert
ComingSoonBadge pattern (aria-disabled, no click handler, tooltip) MUST be
preserved. It renders in the report toolbar's context-control bar, compact and at
the leading edge of that group.

#### Scenario: the context bar renders a deferred placeholder

- **WHEN** the report toolbar's context-control bar renders the Agent review
  placeholder alongside real context controls
- **THEN** the placeholder is compact (smaller than the real actions) and is the
  first element of the group
- **AND** it remains aria-disabled with the ComingSoonBadge tooltip

### Requirement: The word "Publish" appears on exactly one head control

The word "Publish" MUST appear on exactly one control across the head report surface — the publish action (`PublishLockButton`) — which renders in the page header line's document-action group; no other control's visible label MAY carry it.

The Export-PDF control
(`apps/web/src/components/weekly-report/export-pdf-button.tsx`) renders as a
compact 32px icon button carrying its name via `aria-label`/tooltip, not a
visible text label; its unpublished precondition is conveyed by the disabled
state plus an `aria-describedby`/sr-only hint, NOT by a compound label
containing "Publish".

#### Scenario: unpublished period renders the export button

- **WHEN** the period status is `open` and the export icon button renders disabled
- **THEN** it exposes its accessible name "Export PDF" via `aria-label`/tooltip
- **AND** the publish precondition is available via an `aria-describedby`/sr-only
  hint, not by changing the tooltip text
- **AND** only the publish action's visible label contains the word "Publish",
  wherever that action renders on the header line
