# lead-section-draft-payload Specification

## Purpose

Requires the lead draft-save payload to drop rows missing any required text field, so incomplete rows never persist as silent partial data.

## Requirements

### Requirement: Draft-save payload drops rows missing any required text field

MUST drop a section's `risks` and `decisions` rows from the draft-save
payload when any of that record type's required text fields is empty or
whitespace-only, matching the server's `safeText({min:1})` rejection rule, so
an in-progress, not-yet-filled-in row never poisons the whole section's
all-or-nothing save. `sectionToDraftPayload`'s `risks` filter MUST check
`risk`, `impact`, AND `mitigation` — all three of the record's required text
fields — the same way the `decisions` filter already checks `text`, `owner`,
AND `impact`.

#### Scenario: A risk with a blank impact is excluded from the payload

- **GIVEN** a risk row with non-empty `risk` and `mitigation` text but a
  whitespace-only `impact`
- **WHEN** the section is converted via `sectionToDraftPayload`
- **THEN** that risk is excluded from the payload's `risks` array
- **AND** it remains in local UI state, unaffected, for the lead to finish
  filling in

#### Scenario: A fully-filled risk is included in the payload

- **WHEN** a risk row has non-empty `risk`, `impact`, and `mitigation`
- **THEN** it is included in the payload's `risks` array

#### Scenario: The decisions filter is unchanged

- **WHEN** a decision row is missing any of `text`, `owner`, or `impact`
- **THEN** it continues to be excluded from the payload's `decisions` array,
  as before this change
