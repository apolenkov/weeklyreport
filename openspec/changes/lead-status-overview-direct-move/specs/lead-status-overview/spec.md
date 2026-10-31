# Spec Delta: lead-status-overview

## MODIFIED Requirements

### Requirement: Overview previews MUST preserve reading and secondary-action access

Editable Current/Next previews MUST keep readable copy, a separate complete-editor action, a status interaction, and one applicable secondary-action disclosure. Read-only previews MUST expose no write action. Move MUST follow the placement-or-acknowledgement contract in `record-status-derivation`, not reinterpret Continue next week.

#### Scenario: the lead reads and edits a long update

- **WHEN** an editable long update is collapsed
- **THEN** its full-text disclosure remains operable and its copy remains readable
- **AND** copy activation opens the editor with accessible name `Edit item: <update text>`
- **AND** its status icon is named `Status of <update text>: <status>`
- **AND** Edit details opens the same editor

#### Scenario: secondary actions share one disclosure

- **WHEN** Edit details, Update status, or an applicable Move action exists
- **THEN** one disclosure named `More actions for <update text>` exposes those actions
- **AND** it is absent when no secondary action applies
- **AND** outcome actions, text disclosure, and focus restoration remain operable

#### Scenario: a Current occurrence is postponed to Next

- **WHEN** the lead selects Move to next week for an eligible Current item without a separate next commitment
- **THEN** that occurrence is moved directly to Next without opening the canonical editor
- **AND** the move patch preserves stored progress, text, and stable identity while clearing `carriedOver`
- **AND** the change is persisted through the standard draft save pipeline

#### Scenario: Move keeps a saved next step and never promotes

- **WHEN** the lead selects Move to next week for an eligible Current item that already carries a saved next step
- **THEN** no editor opens; the item stays Current with its description and the saved next step, and the Next lane keeps projecting that plan
- **AND** the acknowledgement rides the ordinary draft save, the continuation-promotion command is not called, and focus returns to the More actions trigger
