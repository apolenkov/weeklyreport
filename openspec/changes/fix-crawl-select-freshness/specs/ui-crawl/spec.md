## ADDED Requirements

### Requirement: Native select assignments are checked at action time

The crawler MUST recheck native select type, enabled state and option availability before changing a value. Unavailable assignments MUST NOT dispatch events or count as successful presses. Full traversal MUST retain its exact planned value. Quick traversal MUST choose another enabled option only when its still-available planned value has become current.

#### Scenario: Availability changes after probing

- **WHEN** the select or planned option becomes disabled, disappears or changes type
- **THEN** the attempt is explicitly unsuccessful and input/change are not dispatched

#### Scenario: Current value changes after probing

- **WHEN** the planned option becomes the current value
- **THEN** quick traversal can choose a different enabled option
- **AND** full traversal preserves the exact assignment without claiming a new press

#### Scenario: A valid assignment

- **WHEN** an enabled native select has the enabled planned option
- **THEN** its value changes to that option and input/change events are dispatched
