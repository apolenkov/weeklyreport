# Spec Delta

## ADDED Requirements

### Requirement: Automatic carry-over retains structured operational outcomes

The production period auto carry-over provider MUST use the shared APP_LOGGER. Its outcome event text and target/source/count/reason fields MUST reach the existing logger as message and context, without object-to-string flattening or an additional sink. Carry-over writes, retries and lifecycle behavior MUST remain unchanged.

#### Scenario: Automatic carry-over completes or fails

- **WHEN** the production-wired carry-over hook produces its existing completed or skipped diagnostic
- **THEN** the shared logger receives the meaningful message and structured outcome fields
