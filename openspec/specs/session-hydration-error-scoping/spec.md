# session-hydration-error-scoping Specification

## Purpose

Requires session resolution to map only a token-verification failure to null, letting a transient hydration error propagate rather than silently degrading an authenticated caller to anonymous.

## Requirements

### Requirement: Session resolution only maps a token-verification failure to null

`resolveHumanSession` MUST return `null` only when `deps.verifySessionToken`
throws (an invalid, expired, tampered, or otherwise unverifiable token). An
error raised by `isUserAccessBarred` or by any step of `hydrateSession`
(branding/reporting-group hydration, organization hydration, viewer group
access, section resolution) MUST propagate out of `resolveHumanSession`
rather than being caught and mapped to `null`.

#### Scenario: An invalid token resolves to no session

- **GIVEN** a session token that fails `verifySessionToken`
- **WHEN** `resolveHumanSession` is called with that token
- **THEN** it resolves to `null`

#### Scenario: A transient hydration failure does not resolve to no session

- **GIVEN** a session token that verifies successfully and is not access-barred
- **AND** `hydrateSession` throws (e.g. a transient database error during
  reporting-group or organization hydration)
- **WHEN** `resolveHumanSession` is called with that token
- **THEN** the error propagates out of `resolveHumanSession`
- **AND** it is not mapped to `null`

#### Scenario: An access-bar check failure does not resolve to no session

- **GIVEN** a session token that verifies successfully
- **AND** `isUserAccessBarred` throws (e.g. a transient database error)
- **WHEN** `resolveHumanSession` is called with that token
- **THEN** the error propagates out of `resolveHumanSession`
- **AND** it is not mapped to `null`
