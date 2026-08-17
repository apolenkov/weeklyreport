## ADDED Requirements

### Requirement: Provider card prioritizes the current operation result

Settings → AI → Provider MUST display feedback from the administrator's current save, test, activation, disable, restore, or discard operation ahead of historical execution feedback from the observed provider revision. Historical capability and compatibility status MUST remain visible as revision detail, but MUST NOT be presented as the outcome of a newer operation.

#### Scenario: Draft save fails while the previous revision has a failed test

- **WHEN** `admin.aiProvider.save` returns a safe error while the observed retained revision has an older failed compatibility execution
- **THEN** the Provider card displays the save error as the current status
- **AND** it does not replace that error with the older capability-test failure message

#### Scenario: No current operation feedback exists

- **WHEN** the Provider card observes a completed historical execution and no current operation has produced feedback
- **THEN** the card displays the bounded historical execution result
