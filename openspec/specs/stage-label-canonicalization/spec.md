# stage-label-canonicalization Specification

## Purpose

Keep stored stage identifiers and user-visible record stage labels aligned to the canonical stage vocabulary.

## Requirements

### Requirement: Stored stage identifiers are canonical

The stored stage identifier on a record (item, risk, or decision `stageIds`) MUST
be the full canonical SDLC stage name, so records created through a dialog store
the same value as the seed.

1. The web-side `STAGE_NAMES` source that feeds every record dialog's stage
   options MUST list the canonical names (`Planning`, `Analysis`, `Design`,
   `Development`, `Testing`, `DevOps`, `Support`).
2. Saving a record from any dialog MUST persist the canonical stage name in
   `stageIds`.

#### Scenario: A dialog-created item stores the canonical stage

- **WHEN** a lead adds an item on a product whose owned stage is Development and
  saves with that stage selected
- **THEN** the stored `stageIds` contains `Development`, not `Dev`

### Requirement: Record stage labels display the canonical name

A surface that renders a stored stage identifier as a text label on a record (the item-card stage chip and any equivalent record tag) MUST display the canonical stage name.

1. Rendering MUST display the stored canonical stage name.
2. The SDLC pipeline chip MAY render a display-only short label
   (`Development` shown as `Dev`) for its seven-across layout; this short form is a
   rendering choice and MUST NOT be persisted or used for matching.

#### Scenario: The pipeline chip renders the canonical stage

- **WHEN** the SDLC pipeline renders the Development stage chip
- **THEN** the chip's stored and matched value is `Development`
- **AND** any short display label remains presentation-only
