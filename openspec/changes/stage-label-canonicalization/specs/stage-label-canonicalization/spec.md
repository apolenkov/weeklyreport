## ADDED Requirements

### Requirement: Stored stage identifiers are canonical

The stored stage identifier on a record (item, risk, or decision `stageIds`) MUST be the full canonical SDLC stage name, never a short UI alias, so records created through a dialog store the same value the seed stores.

1. The web-side `STAGE_NAMES` source that feeds every record dialog's stage
   options MUST list the canonical names (`Planning`, `Analysis`, `Design`,
   `Development`, `Testing`, `DevOps`, `Support`) — the `Development` slot MUST NOT
   be the short `Dev`.
2. Saving a record from any dialog MUST persist the canonical stage name in
   `stageIds`.
3. The existing match-tolerance helpers (`canonicalStageName`,
   `stageNamesMatch`, `riskCoversStage`) MUST continue to treat a legacy `Dev`
   value as equal to `Development`, so previously stored rows keep matching.

#### Scenario: A dialog-created item stores the canonical stage

- **WHEN** a lead adds an item on a product whose owned stage is Development and
  saves with that stage selected
- **THEN** the stored `stageIds` contains `Development`, not `Dev`

#### Scenario: A legacy "Dev" row still matches Development

- **WHEN** a stored record carries the legacy `stageId` `Dev`
- **AND** a risk or query matches against the `Development` stage
- **THEN** the match-tolerance helpers treat them as the same stage

### Requirement: Record stage labels display the canonical name

A surface that renders a stored stage identifier as a text label on a record (the item-card stage chip and any equivalent record tag) MUST display the canonical stage name, canonicalizing a legacy short value at render so the list reads as one consistent vocabulary.

1. Rendering MUST pass the stored value through `canonicalStageName` before
   display, so a stored `Dev` shows as `Development` without a data migration.
2. The SDLC pipeline chip is exempt: it MAY render a display-only short label
   (`Development` shown as `Dev`) for its seven-across layout; this short form is a
   rendering choice and MUST NOT be persisted or used for matching.

#### Scenario: Mixed legacy and new records read consistently

- **WHEN** a product card shows one seeded item stored as `Development` and one
  dialog-created item that historically stored `Dev`
- **THEN** both render their stage chip as `Development`

#### Scenario: The pipeline chip keeps its short label

- **WHEN** the SDLC pipeline renders the Development stage chip
- **THEN** it MAY show the short `Dev` label
- **AND** the stored and matched value remains `Development`
