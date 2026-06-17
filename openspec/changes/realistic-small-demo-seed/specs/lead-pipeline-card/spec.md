# lead-pipeline-card

## ADDED Requirements

### Requirement: An unowned SDLC stage renders muted, not as an error

An SDLC stage that no one owns MUST render as a muted, low-emphasis chip that
stays part of the visible 7-stage pipeline, and MUST NOT read as a broken or
error state.

The chip MUST keep its place in the full pipeline so the pipeline structure is
never hidden. Its label and tooltip MUST NOT frame the stage as an error or
demand a corrective action (no "Contact admin"-style prompt); they MUST read
neutrally as "this stage is not part of this lead's contribution". This applies
wherever the lead pipeline shows an unowned stage, including the read-only and
slides paths. It applies only to the unowned (`unassigned`) ownership state, not
to an owned stage or a foreign-owned (`locked`) stage.

#### Scenario: a product with stages the lead does not own

- **WHEN** a lead opens a product whose pipeline includes SDLC stages no one owns
- **THEN** each unowned stage renders as a muted, low-emphasis chip still in the
  7-stage row
- **AND** its label and tooltip read neutrally, with no error framing and no
  "Contact admin" action prompt

#### Scenario: a fully-owned product shows no unowned chips

- **WHEN** a lead opens a product whose every SDLC stage they own
- **THEN** all seven stages render as owned
- **AND** no muted unowned chip appears on that product

#### Scenario: an unowned stage is visually distinct from a foreign-owned one

- **WHEN** a product's pipeline contains both an unowned stage and a
  foreign-owned (locked) stage
- **THEN** the unowned stage renders muted and neutral without an owner
- **AND** the foreign-owned stage keeps its distinct locked treatment
