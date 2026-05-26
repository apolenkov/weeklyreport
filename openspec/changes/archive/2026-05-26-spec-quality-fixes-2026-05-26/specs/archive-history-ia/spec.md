## MODIFIED Requirements

### Requirement: Each Entry Point Carries an Explanatory Tooltip or Label

The History and Archive navigation controls MUST each include an
explanatory tooltip (or aria-label) describing what the surface
contains. The text MUST make the distinction unambiguous without
requiring the user to click into either.

#### Scenario: User hovers over History

- **WHEN** the user hovers over (or focuses) the History control
- **THEN** a tooltip or aria-label reading "Snapshots and edits within this report" is announced

#### Scenario: User hovers over Archive

- **WHEN** the user hovers over (or focuses) the Archive control
- **THEN** a tooltip or aria-label reading "Past weeks and closed reports" is announced
