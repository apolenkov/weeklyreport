# Spec Delta

## ADDED Requirements

### Requirement: A readOnly-window raise signal never prefills a later create dialog

A chip/pill raise signal (`addPrefill`) that arrives while the risk section is
`readOnly` MUST be consumed without caching its stage/severity prefill and
without opening the dialog, so a later plain +Add in editable mode still opens
with no SDLC stage pre-selected per the no-pre-select rule. The readOnly
no-dialog guard and one-shot signal semantics are unchanged.

#### Scenario: A raise signal arrives while the section is read-only

- **WHEN** a fresh raise signal with a `blocked` severity arrives while
  `readOnly` is true
- **THEN** no dialog opens
- **AND** a subsequent plain +Add after returning to editable opens the
  create form with the default (`at-risk`) severity, not the signal's

### Requirement: A locked risk card does not show the action-implying stage nudge

A risk card that offers no edit affordance (read-only section or foreign row
rendering `LockBadge`) MUST NOT show the "Select at least one stage" nudge,
since the viewer cannot act on it. Editable product-parented rows keep the
nudge under the existing stage-required rule.

#### Scenario: A stage-less foreign card on a flagged product

- **WHEN** a foreign risk with no stages renders against an at-risk or
  blocked linked product
- **THEN** no stage nudge is shown
- **AND** the foreign lock disclosure remains visible
