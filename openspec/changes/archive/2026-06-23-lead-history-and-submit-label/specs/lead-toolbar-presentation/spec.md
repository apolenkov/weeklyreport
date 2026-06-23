# Lead Toolbar Presentation

## ADDED Requirements

### Requirement: The lead commit control is labeled "Submit"

The lead's forward commit control on the report header MUST be labeled
"Submit" (not "Submit Section"). On the lead report page a lead only ever
sees their own section, so "Section" adds no information; the shorter
label reads cleanly against the adjacent "Save" control. This label is
the normative source and supersedes incidental "Submit Section" naming in
other toolbar specs, which name the same control descriptively. The
submit confirmation dialog MAY keep fuller explanatory wording, but its
primary action MUST also read "Submit".

#### Scenario: Lead sees the commit control

- **WHEN** a lead views an editable, not-yet-submitted report
- **THEN** the forward commit button reads "Submit"
- **AND** it is not labeled "Submit Section"

#### Scenario: Submit confirmation primary action

- **WHEN** the lead opens the submit confirmation dialog
- **THEN** the dialog's primary action button reads "Submit"
