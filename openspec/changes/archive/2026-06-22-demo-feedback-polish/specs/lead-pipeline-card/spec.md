## ADDED Requirements

### Requirement: The +N more reveal color-codes each hidden stage row by status

The `+N more` reveal popover MUST color-code each hidden-stage row by that
stage's effective status so problem stages stand out at a glance: blocked → the
blocked (red) token, at-risk → the at-risk (amber) token, on-track → the
on-track (green) token, and unassigned/empty → a neutral muted treatment. The
colors MUST resolve through the existing `STATUS_CONFIG` / `--color-*` tokens —
no new color token may be introduced — and the per-row status MUST come from the
already-computed effective status of each hidden stage, not a re-derivation.

#### Scenario: hidden stages have mixed statuses

- **WHEN** the lead hovers the `+N more` reveal and the hidden stages include a
  blocked stage, an at-risk stage, an on-track stage, and an unassigned stage
- **THEN** the blocked row renders in the red token, the at-risk row in amber,
  the on-track row in green, and the unassigned row in the neutral muted treatment
- **AND** every color resolves through an existing token (no new token is added)

#### Scenario: a foreign-owned stage shows the covering status

- **WHEN** a hidden stage is held by another owner with a covering status
- **THEN** the row is colored by that covering (effective) status, consistent
  with the chip's display floor
