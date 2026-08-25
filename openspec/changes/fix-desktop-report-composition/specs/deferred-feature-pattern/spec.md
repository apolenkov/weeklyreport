## ADDED Requirements

### Requirement: Slide-template selection leaves one canonical deferred trace

Until selectable slide templates are implemented, the Head presentation context MUST render exactly one inert `Slide templates` control through the shared Coming-Soon pattern. It MUST NOT imply that a template can be selected or persist a hidden choice.

#### Scenario: Head opens slides before templates are implemented

- **WHEN** the Head views a report in slides mode
- **THEN** one visible `Slide templates` Coming-Soon affordance renders beside the presentation context
- **AND** activating it performs no navigation, mutation, or template change
