## ADDED Requirements

### Requirement: Recovery actions remain readable and reachable

The session-load, route/global, and query error recovery surfaces MUST keep the recovery action's visible text inside its button bounds at wide and narrow viewport widths. An enabled recovery action MUST remain keyboard focusable and activate its existing retry or reset behavior.

#### Scenario: Session recovery is shown after a transport failure

- **WHEN** an authenticated session read fails and the session-load recovery surface appears
- **THEN** the complete “Try again” text fits inside the visible button at 1280 px and 375 px viewport widths
- **AND** keyboard activation starts the existing retry
- **AND** if the recovery action remains visible during retry, it retains its existing disabled state and progress label
- **AND** a successful retry restores the session surface

#### Scenario: Rendering recovery exposes reset

- **WHEN** the route/global or query error recovery surface renders
- **THEN** its “Try again” action uses the same readable content layout
- **AND** it retains its existing reset callback and recovery copy
