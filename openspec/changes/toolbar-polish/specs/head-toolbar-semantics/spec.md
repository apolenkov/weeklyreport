# head-toolbar-semantics

## MODIFIED Requirements

### Requirement: Segmented toggles in the head report header share one visual family

The segmented controls in the head report header MUST render as one visual
family — `ScopeToggle`
(`apps/web/src/components/report-shell/scope-toggle.tsx`) and `ViewModeToggle`
(`apps/web/src/components/report-shell/view-mode-toggle.tsx`), composed by
`apps/web/src/components/head/head-report-shell.tsx`: the same brand active-fill
token (`--color-starbucks-accent`, white active text), the same font size tier
(`text-sm` semibold), and the same pill shape. `ScopeToggle` and `ViewModeToggle`
MUST be visually identical so the head and lead toolbars read as one control
family. Group separation MUST be carried by the wrapper border/spacing, not by
divergent control styling. A new segmented control added to this header MUST adopt
the same family.

#### Scenario: the header renders both toggles

- **WHEN** the head report header renders the scope toggle and the view-mode
  toggle together
- **THEN** both use the brand green active-fill token, font size, and pill shape
- **AND** the two toggles are visually identical, separated only by wrapper
  spacing

### Requirement: The word "Publish" appears on exactly one header control

The word "Publish" MUST appear on exactly one control across both header rows of
the head report surface — the publish action (`PublishLockButton`); no other
control's visible label MAY carry it. The Export-PDF control
(`apps/web/src/components/weekly-report/export-pdf-button.tsx`) renders as a
compact 32px icon button carrying its name via `aria-label`/tooltip, not a visible
text label; its unpublished precondition is conveyed by the disabled state plus
the tooltip, NOT by a compound label containing "Publish".

#### Scenario: unpublished period renders the export button

- **WHEN** the period status is `open` and the export icon button renders disabled
- **THEN** it exposes its accessible name "Export PDF" via `aria-label`/tooltip
- **AND** the publish precondition is available via the tooltip
- **AND** only the publish action's visible label contains the word "Publish"
