# Spec Delta

## MODIFIED Requirements

### Requirement: Short display form

The system SHALL provide a short name form composed as surname plus the
initials of the given name and patronymic — «Баленков А.В.», or «Баленков А.»
when there is no patronymic — and the admin Users table SHALL show this short
form.

#### Scenario: short form with patronymic

- **WHEN** parts are lastName="Баленков", firstName="Александр",
  middleName="Владимирович"
- **THEN** the short form is "Баленков А.В."

#### Scenario: short form without patronymic

- **WHEN** parts are lastName="Баленков", firstName="Александр", middleName=null
- **THEN** the short form is "Баленков А."

#### Scenario: A trimmed surname is absent in an admitted read

- **WHEN** an admitted user read has a whitespace surname and present given or patronymic initials
- **THEN** its short display form joins only the present parts without a leading separator
- **AND** normal surname, initial capitalization and whole Unicode code points retain their existing output
