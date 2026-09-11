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
