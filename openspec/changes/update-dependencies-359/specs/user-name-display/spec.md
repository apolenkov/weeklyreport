## MODIFIED Requirements

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

#### Scenario: the navigation home link includes its visible initials in its name

- **WHEN** the signed-in user's two-letter navigation mark links home
- **THEN** its accessible name starts with the visible initials and includes
  the user's full display name and home purpose
- **AND** the link derives that name from its visible mark and visually hidden
  descriptive text, without an overriding ARIA label
