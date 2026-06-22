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

The segmented controls MUST render as one neutral, compact visual family wherever they sit — the head report header, the report toolbar's context-control bar, or the slide hero — using a soft-slate active-selection fill, not the brand accent.

`ScopeToggle` (`apps/web/src/components/report-shell/scope-toggle.tsx`),
`ViewModeToggle` (`apps/web/src/components/report-shell/view-mode-toggle.tsx`),
and `RecordVisibilityToggle` (the lead Mine/Everyone control in
`apps/web/src/components/lead/lead-form.tsx`) MUST compose one shared
presentational primitive (`SegmentedToggle`) so they are visually identical: the
same slate active fill (`--color-toggle-active`, white active text), the same
inactive treatment (a solid `--color-surface-empty` track with
`--color-muted-foreground` text), the same neutral border, the same compact
`text-xs` tier, and the same pill shape. Brand green (`--color-starbucks-accent`)
MUST NOT be the toggle active fill — green is reserved for header-line forward
actions (Submit Section, Publish & Lock). Toolbar instances MUST sit on the
shared toolbar control height (`--toolbar-control-h`); a slide-hero instance MAY
instead match the hero row height so it lines up with the hero badges (the
primitive exposes a size for this). A segment whose meaning has an unambiguous
icon (Edit = pencil, Slides = grid; Mine = one person, Everyone = group) MAY
render icon-only, but MUST keep an accessible name (sr-only text and/or tooltip);
the scope toggle (Product/Leads) keeps compact text. Group separation MUST be
carried by wrapper border/spacing, not by divergent control styling.

#### Scenario: the toggles render as one neutral family

- **WHEN** the report toolbar renders the scope toggle, the view-mode toggle, and
  (on the lead surface) the Mine/Everyone visibility toggle
- **THEN** all use the slate active-fill token, the same compact toolbar height,
  and the same pill shape
- **AND** none uses the brand-accent token as its active fill

#### Scenario: an icon-only segment keeps an accessible name

- **WHEN** the view-mode toggle renders its Edit and Slides segments icon-only
- **THEN** each segment still exposes an accessible name (e.g. "Edit" / "Slides")
  via sr-only text and/or tooltip, not an empty icon-only control

#### Scenario: the slide-hero scope toggle aligns with the hero row

- **WHEN** the slide hero renders its scope toggle alongside the hero status
  badges
- **THEN** the toggle uses the same slate family but matches the hero row height,
  not the smaller toolbar control height

### Requirement: Header utility actions carry visible text labels

Head-report-header utility links MUST render a visible text label next to
their icon ("Present", "Print") — icon-only rendering is not allowed for
the actions that navigate to a distinct surface (the
`/head/report/[id]/present` link and the `/print/[reportId]` link in
`head-report-shell.tsx`). Labels MUST honestly name the surface: the
browser-print
template is labeled "Print", not "Export PDF" or "Print PDF".

#### Scenario: utility links render

- **WHEN** the head report header renders the presentation and print
  links
- **THEN** each shows its icon plus a visible text label
- **AND** the print link is labeled "Print" (distinct from the
  publish-gated "Export PDF" action)

### Requirement: Deferred placeholders render visually subordinate

An inert deferred-feature placeholder MUST render visually subordinate to real actions — compact — and MUST lead its control group: the head report header, or the right-aligned view-control group of the report toolbar's context bar.

Today this placeholder is `AgentReviewComingSoon`
(`apps/web/src/components/report-shell/agent-review-coming-soon.tsx`). The inert
ComingSoonBadge pattern (aria-disabled, no click handler, tooltip) MUST be
preserved. In the report toolbar's context bar the controls form two clusters —
period navigation (and the show-archived filter) anchored left, and the
right-aligned view-control group (Agent review, scope, view mode, expand-all)
pushed right by a spacer. The placeholder is compact and leads that right-aligned
view-control group; it is NOT required to be the first element of the whole bar
(the period navigator is).

#### Scenario: the context bar renders a deferred placeholder

- **WHEN** the report toolbar's context bar renders the Agent review placeholder
  alongside the right-aligned view controls (scope, view mode)
- **THEN** the placeholder is compact (smaller than the real actions) and is the
  first element of the right-aligned view-control group, following the
  left-anchored period navigation
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

### Requirement: The view-mode toggle reflects the active mode and view state persists in the URL

The view-mode toggle MUST highlight the segment that matches the current view
(Edit vs Slides), so the active segment always reflects the on-screen mode. The
toggle MUST receive the real current mode, not a hard-coded default. In addition,
the head report view state — the view mode, the scope (Product / Leads), and the
show-archived filter — MUST be encoded in the URL so that navigation, a page
refresh, and a shared link all preserve the selection.

#### Scenario: the deck is on screen

- **WHEN** the head is viewing the slide deck (`?mode=slides`)
- **THEN** the Slides segment is highlighted as active
- **AND** the Edit segment is not highlighted

#### Scenario: refresh preserves the view state

- **WHEN** the head selects a scope, the slides mode, and the show-archived
  filter, then refreshes the page or opens the shared URL
- **THEN** the same mode, scope, and show-archived filter are restored from the URL
- **AND** the active toggle segment matches the restored mode
