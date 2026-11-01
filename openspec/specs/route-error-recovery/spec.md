# route-error-recovery Specification

## Purpose

Give route and global error boundaries consistent recovery behavior without
promising data preservation that has not been verified.

## Requirements

### Requirement: Route recovery copy states only proven behavior

The normal and global Next.js error boundaries MUST describe the page
interruption and expose the framework reset action. Their recovery copy MUST
NOT claim that user data is safe unless the boundary itself has evidence that
all affected drafts were persisted or restored.

#### Scenario: A rendering error reaches a route boundary

- **WHEN** the normal or global error boundary renders
- **THEN** it announces that an unexpected error interrupted the page
- **AND** it offers the “Try again” reset action
- **AND** it makes no unconditional data-preservation promise

### Requirement: Error boundaries share recovery behavior

The normal and global error boundaries MUST use the same recovery content and
error-capture effect. The global boundary MUST retain its standalone app
stylesheet import and render the shared content inside its own `html` and
`body` document shell.

#### Scenario: Global layout rendering fails

- **WHEN** the global error boundary renders without the root layout
- **THEN** the document retains `html lang="en"`, `body`, and the app stylesheet
- **AND** the shared recovery content captures the error and invokes the
  supplied reset callback from “Try again”

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
