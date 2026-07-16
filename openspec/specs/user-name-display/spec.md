# user-name-display Specification

## Purpose

Apply one canonical user-name display form per surface, including short cross-author stage-owner labels.

## Requirements

### Requirement: One name-display form per surface

The system SHALL render a user's name in exactly one of three forms per surface:
the **full ФИО** only in the user's own top navigation badge; the **two-letter
mark** for round avatar chips and the item-row stage micro-chip; and the **short
form** («Фамилия И.О.») for every other place a name appears as a spelled-out text
label.

#### Scenario: full ФИО only in the own top badge

- **WHEN** the navigation bar renders for the signed-in user
- **THEN** the user's own profile badge shows the full ФИО «Иванов Василий Петрович»
- **AND** no other surface renders the full ФИО

#### Scenario: short form for spelled-out name labels

- **WHEN** a name is rendered as a text label on an SDLC stage owner (own or
  cross-author), a slide owner or contributor, the leads summary table, a
  cross-author content author, or a dashboard escalation assignee
- **THEN** it shows the short form «Иванов В.П.» (surname + dotted initials)
- **AND** never the full ФИО and never the bare two-letter mark

#### Scenario: two-letter mark for avatars and micro-chips

- **WHEN** a round avatar chip or the item-row stage micro-chip «Development · ВИ»
  renders
- **THEN** it shows the two-letter mark «ИВ» (surname + given initial)

### Requirement: Cross-author stage owner carries a short name

The cross-author status read SHALL expose a co-owner's short name so the foreign
stage label can render the short form; it MUST NOT expose the full ФИО.

#### Scenario: foreign stage label shows the short form

- **WHEN** a lead views an SDLC stage owned by a co-owner on a shared product
- **THEN** the stage owner label shows the co-owner's short form «Каштанова М.А.»
- **AND** the server response carries only the short name, never the full ФИО
