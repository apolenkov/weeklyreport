## ADDED Requirements

### Requirement: Presentation modules type against the real model, not a mock/legacy module

A web presentation module MUST import its display-data type from the real
domain model that produces the data it renders, or from the consuming
feature's own documented self-contained presentation type, and MUST NOT
import a structurally-similar type from a mock or legacy data module (for
example `shared/lib/dashboard-mock-data.ts`, `shared/lib/admin-mock-data.ts`)
when a real-model or self-contained type already exists for the same shape.
When a mapper's output type omits a field the mapper actually assigns, the
field MUST be added to the mapper's declared return type instead of being
recovered downstream with an `as` type assertion.

#### Scenario: a component imports its data type from the real model

- **WHEN** a presentation component receives data produced by a real-model
  mapper (for example `KpiCards` receiving `KpiData` built by
  `features/dashboard/model/dashboard.ts`)
- **THEN** the component's prop type is imported from that real model
- **AND** it is not imported from a mock or legacy module that happens to
  declare a structurally identical type

#### Scenario: a mapper's declared return type covers every field it assigns

- **WHEN** a mapper function assigns a field to the object literals it
  returns (for example `mapLeadItems` assigning `pausedReason`)
- **THEN** the mapper's declared return type includes that field
- **AND** no downstream consumer needs an `as` assertion to recover the field

#### Scenario: a feature module's self-contained type is not bypassed

- **WHEN** a feature module documents a presentation type as intentionally
  self-contained so consumers do not couple to a particular mock/legacy UI
  module (for example `admin-types.ts`'s `MockReminder`/`MockReminderPolicy`)
- **THEN** other files in that feature import the self-contained type from
  the documented module
- **AND** they do not import the structurally similar type from the
  mock/legacy module the self-contained type was created to decouple from
