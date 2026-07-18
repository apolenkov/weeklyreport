# stage-step-shared-component Specification

## Purpose

Requires product-parent stage selection to use one shared component across record types, eliminating the RecordStageStep/RiskStageStep duplication.

## Requirements

### Requirement: Product-parent stage selection uses one shared component across record types

The stage-selection control for a product-scoped item, decision, or risk record — the multi-select plus the zero-owned-stage "contact admin" notice — MUST be implemented by a single shared component (`StageStep` in `apps/web/src/features/report-sections/ui/`), parameterized by the caller's dead-end notice text and optional severity preview, and MUST NOT be re-implemented per record type as separate near-duplicate components. An activity parent, which owns no SDLC stage, MUST NOT render this control at all — callers gate it on a product parent, unchanged from today's behavior.

#### Scenario: Item, Decision, and Risk dialogs render the same underlying component

- **WHEN** the Item, Decision, or Risk edit dialog renders its product-parent
  stage-selection step
- **THEN** all three render the shared `StageStep` component
- **AND** no record type has its own separate stage-selection implementation

#### Scenario: Dead-end notice text is a call-site concern

- **GIVEN** a product parent with zero owned stages
- **WHEN** the shared `StageStep` component renders in the dead-end branch
- **THEN** it shows the notice text the caller supplied
- **AND** the required-stage validation error is suppressed while the
  dead-end notice is shown, exactly as before this change

#### Scenario: Risk's severity preview still renders

- **GIVEN** the Risk edit dialog, which additionally previews severity on
  the stage multi-select
- **WHEN** the Risk dialog renders `StageStep`
- **THEN** the severity preview still renders, passed through as an
  optional prop
