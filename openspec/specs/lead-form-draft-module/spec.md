# lead-form-draft-module Specification

## Purpose

Own lead-form draft state, reconciliation, serialization, save classification, optimistic locking, submit readiness, and merge behavior behind one deep module.

## Requirements

### Requirement: The lead-form draft flow is one deep module

The lead-form draft lifecycle (draft state, reconciliation, save and save-echo classification, optimistic-lock versioning, submit readiness, submit, merge application) MUST be owned by one module exposing one handle (`draft`, `dirty`, `version`, `save`, `submit`, `submitReadiness`, `apply`, plus the named branching handlers with their pending-request values); the form MUST NOT thread live data between hooks through cross-file mutable-ref protocols (the autosave engine's single mutable live-state holder lives in one engine module, stays private to it, and is exposed to the rest of the module only through intent operations, never as a shared ref or field accessor), and downstream components MUST NOT receive whole hook return types as props.

#### Scenario: Draft interactions are unit-testable through the handle

- **WHEN** a test drives quick-add, save, conflict, and submit through the module's handle with a fake write seam
- **THEN** the complete sequencing is exercised deterministically in one unit test file

#### Scenario: No ref smuggling survives

- **WHEN** the lead form renders
- **THEN** no component or hook repopulates a mutable ref each render to expose live state to another file
- **AND** the autosave live-state holder type is referenced only inside the autosave engine module

#### Scenario: Components declare narrow interfaces

- **WHEN** a lead-form child component's props are inspected
- **THEN** each field is a value or handler the component itself reads
- **AND** no props type references a draft hook's return type or a sibling hook type

#### Scenario: The characterization suite covers the complete draft lifecycle

- **WHEN** the characterization suite covers autosave, save echo, optimistic
  locking, quick add, and submit gating through the deep module
- **THEN** every declared draft-lifecycle behavior passes

### Requirement: Stable serialization MUST distinguish payloads that differ only by Date value

The Lead Form draft comparison-key encoder (`encodeAutosaveComparisonKey`) MUST serialize a
`Date` value into a form that differs whenever the underlying instant
differs, so that dirty-state detection and content-based record identity
never collapse two distinct dates into the same key.

#### Scenario: Deadline-only edit marks the autosave payload dirty

- WHEN the current draft payload and the last-saved payload are identical
  except that one field is a `Date` and its value has changed
- THEN `encodeAutosaveComparisonKey` produces different keys for the two payloads
- AND the autosave hook's `dirty` flag becomes `true`

#### Scenario: Same-text decisions with different deadlines keep distinct content keys

- WHEN two decision records have identical text but different `deadline`
  `Date` values and neither carries a `stableId`
- THEN `recordContentKey` produces a different key for each record
- AND `reconcileSavedIdentities` does not swap their `id`/`stableId` between
  them during save-identity reconciliation

#### Scenario: Non-Date fields are unaffected

- WHEN a payload contains only primitive, array, or plain-object fields (no
  `Date`)
- THEN `encodeAutosaveComparisonKey`'s output is unchanged from its current behavior

### Requirement: The data hook crosses the component seam as a declared slice

`LeadFormLoaded` and every component below it MUST receive server-loaded data through a purpose-built declared interface (`LeadFormLoadedData`), never as `ReturnType<typeof useLeadFormData>` or any other whole-hook return type; the slice declares exactly the fields its consumers read.

#### Scenario: No hook return type in any props interface

- **WHEN** props interfaces under `features/report-pages/ui/` are inspected
- **THEN** none references `ReturnType<typeof use…>`
- **AND** `LeadFormLoaded`'s data prop is the declared slice
