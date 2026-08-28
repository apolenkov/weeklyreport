## MODIFIED Requirements

### Requirement: Export PDF is a compact icon button

The head Export-PDF control SHALL render as the shared 32px toolbar icon button,
matching the lead utility row, rather than a labeled text button. Its
`aria-label` and action-name tooltip SHALL stay equivalent to "Export PDF"
(per the toolbar icon-button primitive). When export is disabled because the
displayed report is unpublished or reopened, the publish prerequisite SHALL
remain associated with the button for assistive technology and SHALL also be
visibly discoverable by both pointer hover and keyboard focus without enabling
the action or replacing its accessible name.

#### Scenario: export renders for a published period

- **WHEN** the head opens a published report
- **THEN** Export-PDF renders as a 32px icon button whose `aria-label`/tooltip
  names the action "Export PDF"

#### Scenario: export is gated on an unpublished period

- **WHEN** the displayed period is unpublished
- **THEN** the Export-PDF icon button renders disabled with its accessible name
  and action-name tooltip still "Export PDF"
- **AND** the exact publish prerequisite remains programmatically associated
  with the button and visibly discoverable from its control surface

#### Scenario: pointer user inspects unpublished export

- **WHEN** the displayed period is unpublished and a pointer user hovers the
  disabled Export-PDF control surface
- **THEN** the exact guidance "Publish or re-publish the report to export PDF."
  becomes visible
- **AND** the Export-PDF button remains disabled

#### Scenario: keyboard user inspects unpublished export

- **WHEN** the displayed period is unpublished and a keyboard user focuses the
  disabled Export-PDF control surface
- **THEN** the exact publish prerequisite becomes visible
- **AND** focus does not activate or enable PDF export

#### Scenario: assistive technology inspects unpublished export

- **WHEN** the displayed period is unpublished
- **THEN** the disabled Export-PDF button keeps the accessible name "Export PDF"
- **AND** its publish prerequisite remains programmatically associated as its
  description
