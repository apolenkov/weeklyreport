# web-model-type-boundary Specification

## Purpose

Keep web presentation modules typed against their real domain model or an
explicit self-contained presentation contract, so display types stay a single
source of truth.

## Requirements

### Requirement: Presentation modules use an authoritative display-data type

A web presentation module MUST import its display-data type from the real domain
model that produces the data it renders, or from the consuming feature's own
documented self-contained presentation type. It MUST NOT import a
structurally-similar stand-in type when an authoritative type already exists for
the same shape. When a mapper's output type omits a field the mapper actually
assigns, the field MUST be added to the mapper's declared return type instead of
being recovered downstream with an `as` type assertion.

#### Scenario: a component imports its data type from the real model

- **WHEN** a presentation component receives data produced by a real-model
  mapper (for example `KpiCards` receiving `KpiData` built by
  `features/dashboard/model/dashboard.ts`)
- **THEN** the component's prop type is imported from that real model
- **AND** it is not imported from a stand-in module that happens to declare a
  structurally identical type

#### Scenario: a mapper's declared return type covers every field it assigns

- **WHEN** a mapper function assigns a field to the object literals it
  returns (for example `mapLeadItems` assigning `pausedReason`)
- **THEN** the mapper's declared return type includes that field
- **AND** no downstream consumer needs an `as` assertion to recover the field

#### Scenario: a feature module's self-contained type is authoritative

- **WHEN** a feature module documents a presentation type as intentionally
  self-contained so consumers do not couple to a particular producer
- **THEN** other files in that feature import the self-contained type from
  the documented module
- **AND** they do not import a structurally similar stand-in type
