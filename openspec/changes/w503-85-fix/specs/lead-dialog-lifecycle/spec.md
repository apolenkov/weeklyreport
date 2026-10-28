# Spec Delta

## ADDED Requirements

### Requirement: Editor dialogs protect pending save actions from discard and duplicate submission

Lead editor dialogs and discard confirmation dialogs MUST protect asynchronous save operations from dismissal and repeat activation while saving. When an editor save is in flight (`isPending`), the discard confirmation dialog MUST disable its confirmation and cancellation buttons, suppress backdrop and Escape dismissals, and the dialog footer Save button MUST be disabled with a visible busy state (`savePending`).

#### Scenario: Save is in flight while discard confirmation is open

- **GIVEN** a dirty editor dialog has opened the discard confirmation dialog
- **WHEN** an asynchronous save operation is in flight (`isPending = true`)
- **THEN** the discard confirmation buttons are disabled and backdrop or Escape dismissal is ignored

#### Scenario: Save button is disabled during save mutation

- **GIVEN** an open item, decision, or risk editor dialog
- **WHEN** a save action is triggered and in flight (`isPending = true`)
- **THEN** the Save button in the dialog footer is disabled and indicates saving state (`savePending = true`)
