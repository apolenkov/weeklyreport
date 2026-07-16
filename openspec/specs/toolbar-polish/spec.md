# toolbar-polish Specification

## Purpose

Keep lead and head toolbar controls consistent, evenly spaced, mode-safe, and behaviorally stable around PDF export and header toggles.

## Requirements

### Requirement: Lead and head toolbars share one control vocabulary

The lead and head report surfaces SHALL present the same control language: segmented view toggles in one neutral family, compact 32px icon buttons for icon-only utilities, and labeled pills for named actions — so a user reads the two surfaces as the same interface.

The segmented toggles (Edit/Slides, Product/Leads, Mine/Everyone) SHALL use the
neutral slate active-selection fill (`--color-toggle-active`, white active text),
NOT the brand green — brand green is reserved for the header-line forward actions
(Submit Section, Publish & Lock). The toggles SHALL be visually identical across
the two surfaces. Icon-only utility controls (Export PDF, archive, history, Fill,
the version/PDF Coming-soon stubs) SHALL use the same 32px icon-button treatment
on both surfaces. The lead Save control SHALL render as a labeled neutral pill at
the shared toolbar control height (icon + "Save" text), NOT the brand green; its
transient in-flight state MAY take the accent busy treatment (the one exemption
to the single forward-commit accent rule).

#### Scenario: a user moves between lead and head

- **WHEN** a user views the lead toolbar and then the head toolbar
- **THEN** the segmented toggles look identical (one neutral slate family) on both
- **AND** the icon-only utility actions use the same 32px icon-button treatment
- **AND** no segmented toggle uses the brand-green active fill

#### Scenario: the lead Save control renders

- **WHEN** the lead report toolbar renders the Save control in its idle state
- **THEN** it is a labeled neutral pill ("Save") at the shared toolbar height, not
  a brand-green button and not icon-only
- **AND** while a save is in flight it MAY show the accent busy treatment

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
