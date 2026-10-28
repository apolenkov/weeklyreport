## ADDED Requirements

### Requirement: Saving feedback respects reduced motion

The Lead report saving control MUST keep its progress indicator stationary when the browser requests reduced motion. Its visible saving label, busy state and repeat-activation guard MUST remain available independently of animation. With no reduced-motion preference, the existing animated progress indication MUST remain available.

#### Scenario: Saving with reduced motion

- **GIVEN** the Lead report has an in-flight canonical save
- **WHEN** the browser requests reduced motion
- **THEN** the saving indicator does not rotate over successive rendered frames
- **AND** the saving control remains visibly busy and disabled
- **AND** changing the motion preference does not trigger another save

#### Scenario: Saving with no motion preference

- **GIVEN** the same in-flight save with no reduced-motion preference
- **WHEN** the saving control is observed over successive rendered frames
- **THEN** its animated progress indication remains available
- **AND** it retains the same busy and repeat-activation protections
