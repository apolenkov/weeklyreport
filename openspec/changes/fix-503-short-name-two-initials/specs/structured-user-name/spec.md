## ADDED Requirements

### Requirement: Short form fallback from a plain name

When structured parts are absent, the short form derived from a plain
surname-first name string SHALL consist of the first token (the surname) and the
dotted initials of at most the next two tokens, the same "first and second
token" rule as the initials fallback. Compound given names or surnames written
with spaces are not recognized in a plain string.

#### Scenario: A plain name with extra given tokens

- **WHEN** a record has only the name "Петров Алексей Иван Дмитрий Павел"
- **THEN** the short form is "Петров А.И."

#### Scenario: A patronymic suffix is a token

- **WHEN** a record has only the name "Алиев Рашид Гейдар оглы"
- **THEN** the short form is "Алиев Р.Г."

#### Scenario: A compound given name loses the patronymic without parts

- **WHEN** a record has only the name "Иванова Анна Мария Петровна"
- **THEN** the short form is "Иванова А.М."
- **AND** structured parts give "Иванова А.П."
