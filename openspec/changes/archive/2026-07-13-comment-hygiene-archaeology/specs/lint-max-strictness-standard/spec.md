## ADDED Requirements

### Requirement: Comments and docstrings state facts that match current code

A comment or docstring MUST describe the code's actual current behavior. A
comment that once was accurate but now contradicts the code it sits next to
(because the code changed and the comment did not) MUST be corrected to
match, or removed if it no longer serves a purpose, during any sweep or
review that touches that file.

#### Scenario: A comment claiming a migration seeds data is corrected

- **WHEN** a schema comment states that an init migration seeds or updates a
  singleton row, but the migration has zero DML and a seed script provisions
  the row instead
- **THEN** the comment is corrected to name the seed script as the actual
  provisioning mechanism

#### Scenario: A docstring claiming a call that never happens is corrected

- **WHEN** a service's docstring lists a script as calling one of its public
  methods, but that script has always duplicated the method's logic instead
  of calling it
- **THEN** the docstring is corrected to state the duplication, not a call
  that does not exist

#### Scenario: A docstring's behavioral claim is corrected to match the code

- **WHEN** a docstring says a code path skips a step the code actually
  performs (or vice versa)
- **THEN** the docstring is corrected to match the code, not left standing
  as documentation of a stale prior state
