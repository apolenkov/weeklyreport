## ADDED Requirements

### Requirement: Administrative prompt reads expose one coherent snapshot

`AiPromptRepository.getControl` and the corresponding `admin.aiPrompts` response composed by `AiPromptService.readEntry` MUST read the feature control, included active bundle, latest revision and bounded history from one database snapshot. When the same revision identifier occurs in multiple parts of one response, its lifecycle and prompt payload MUST agree. The latest revision MAY differ from the active bundle, and bounded history MAY omit an older active revision.

#### Scenario: Activation commits between administrative queries

- **GIVEN** a feature has one active revision and a newer validated candidate, both within the history window
- **WHEN** an administrative read has read the control and included active revision, and a concurrent legal activation commits before history is read
- **THEN** the response retains the pre-activation control and active bundle
- **AND** the old revision remains active with matching payload in that response's history, while the latest candidate remains validated in that same snapshot
- **AND** the independently committed activation remains effective for subsequent reads

#### Scenario: A newer draft is distinct from the active bundle

- **WHEN** a feature has an active revision and a newer unactivated draft
- **THEN** the administrative response identifies the older bundle as active and the newer draft as latest
- **AND** each retained revision's lifecycle and payload are consistent throughout the response

#### Scenario: The feature control has not been initialized

- **WHEN** `AiPromptRepository.getControl` reads a feature without a stored control
- **THEN** it returns null without inventing an active bundle or history
