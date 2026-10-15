# Spec Delta

## ADDED Requirements

### Requirement: Probed inputs carry implicit roles without widening the full walk

The crawler probe MUST report an `<input>` without a non-empty explicit role
by its html-aria implicit role: `button`, `submit`, `reset` and `image` as
`button`, `number` as `spinbutton`, `range` as `slider`, `checkbox` and
`radio` as themselves, `text`, `email`, `tel` and `url` as `textbox`, and
`search` as `searchbox`; any of those five with a `list` attribute MUST report
`combobox`. A type without an implicit ARIA role, such as `password` or
`date`, MUST report no role, and an unknown or invalid type MUST be
treated as the browser's `text`. An empty `role` attribute MUST fall back to
the implicit role. The full-walk write guard MUST require a named scenario
for every `<input>` other than checkbox and radio, decided by tag and DOM type
and independent of the reported role, and for every `textbox`; buttons,
checkboxes and radios MUST keep their current admission.

#### Scenario: Native number, range and input button

- **WHEN** the probe reads `number`, `range` and `submit` inputs
- **THEN** they are reported as `spinbutton`, `slider` and `button`
- **AND** the full-walk guard still requires a named scenario for each

#### Scenario: No implicit role or an invalid type

- **WHEN** the probe reads a `date` input and an input with an invalid type
- **THEN** the date input has no role and the other is a `textbox`
- **AND** both still require a named scenario

#### Scenario: Password, search and suggestion inputs

- **WHEN** the probe reads a `password` input, a `search` input and an
  `email` input with a `list` attribute
- **THEN** they report no role, `searchbox` and `combobox`
- **AND** each still requires a named scenario

#### Scenario: Unchanged safe controls

- **WHEN** the full walk plans a button, a checkbox input or a radio input
- **THEN** its admission is the same as before the role correction
