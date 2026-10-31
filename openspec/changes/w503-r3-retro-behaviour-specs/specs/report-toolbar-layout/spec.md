## MODIFIED Requirements

### Requirement: Lead read-only state is stated in the header

When the lead report cannot be edited and the section is not submitted, the
header MUST show a "Read-only" badge in place of the autosave badge and the
subtitle "Read-only report and status context.". An editable report MUST keep
the autosave badge and the subtitle "Your report draft and status context.".
Mutating document actions MUST stay hidden while the report is read-only.
A Submitted or Read-only badge MUST outrank the "Unsaved update" badge of an
open update, so a locked section never reads as editable.

#### Scenario: a past period is opened

- **WHEN** a lead opens a report that is read-only and not submitted
- **THEN** the header shows the "Read-only" badge and the read-only subtitle
- **AND** no autosave badge or Fill from control is rendered

#### Scenario: an open update outlives a locked section

- **GIVEN** an update is open in Overview
- **WHEN** the section becomes submitted or read-only
- **THEN** the header shows "Submitted" or "Read-only" respectively
- **AND** it does not show "Unsaved update"
