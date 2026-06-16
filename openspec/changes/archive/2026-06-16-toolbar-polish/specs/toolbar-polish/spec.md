# toolbar-polish

## ADDED Requirements

### Requirement: Lead and head toolbars share one control vocabulary

The lead and head report toolbars SHALL present the same control language:
segmented navigation toggles in the brand green family, and compact 32px grey
icon buttons for utility actions, so a user reads the two surfaces as the same
interface.

#### Scenario: a user moves between lead and head

- **WHEN** a user views the lead toolbar and then the head toolbar
- **THEN** the segmented toggles look identical (green family) on both
- **AND** the utility actions use the same 32px icon-button treatment on both

### Requirement: Export PDF is a compact icon button

The head Export-PDF control SHALL render as the shared 32px toolbar icon button,
matching the lead utility row, rather than a labeled text button. Its `aria-label`
and tooltip SHALL stay equivalent to the action name "Export PDF" (per the toolbar
icon-button primitive); its unpublished-precondition SHALL be conveyed by the
disabled state plus an `aria-describedby`/sr-only hint, NOT by changing the
tooltip text.

#### Scenario: export renders for a published period

- **WHEN** the head opens a published report
- **THEN** Export-PDF renders as a 32px icon button whose `aria-label`/tooltip
  names the action "Export PDF"

#### Scenario: export is gated on an unpublished period

- **WHEN** the displayed period is unpublished
- **THEN** the Export-PDF icon button renders disabled with its tooltip still
  "Export PDF"
- **AND** the precondition is conveyed via an `aria-describedby`/sr-only hint

### Requirement: Export PDF behavior is preserved across the presentation change

Converting Export PDF to an icon button SHALL change only its presentation; the
existing request → poll → busy/disabled → completion-download → failure-toast
behavior of `ExportPdfButton` SHALL be preserved unchanged.

#### Scenario: a published-period export runs end to end

- **WHEN** the user activates the Export-PDF icon button on a published period
- **THEN** the export mutation requests, polls status, shows the busy/disabled
  state, and on completion opens the artifact for download
- **AND** a failure surfaces the existing error toast

### Requirement: The lead toolbar button row is evenly spaced

The lead toolbar's icon-button row SHALL use one consistent gap between every
button (Fill-from, Choose-past, Version, PDF, Save), with no larger gap before
any single control.

#### Scenario: the lead toolbar renders its action row

- **WHEN** the lead report toolbar renders its icon-button row
- **THEN** the spacing between adjacent buttons is uniform across the row

### Requirement: Selecting a header toggle opens no dialog

Selecting a header toggle (scope or view-mode) SHALL NOT open any item, risk, or
decision dialog. Toggling only changes the grouping/view; dialogs open only from
a direct user action on a dialog control.

#### Scenario: the user picks a scope or view-mode toggle

- **WHEN** the user clicks the scope toggle or the view-mode toggle on the report
- **THEN** the grouping/view changes
- **AND** no item/risk/decision dialog opens as a side effect
