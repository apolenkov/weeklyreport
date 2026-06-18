## MODIFIED Requirements

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
