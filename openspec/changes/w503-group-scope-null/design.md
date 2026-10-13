# Design

## Context

See proposal.md. The scope API already requires a session and explicitly rejects
undefined. HTTP authentication rejects null earlier; this guard is a defensive
repository boundary with both filter-producing and guard-only callers.

## Goals / Non-Goals

Close the absent-null gap in the existing guard. Keep all defined role sessions
and canonical group filters unchanged. No generic shape or role validator.

## Decisions

Before: null → guard passes → query construction or later field-access error.
After: null/undefined → same explicit guard error before query construction.

Use an explicit null comparison alongside the existing undefined check and add
null to the guard's accepted input type. Extend the existing missing-session
test as a two-row table; valid-role controls still exercise the real guard.

## Risks / Trade-offs

- Internal callers that incorrectly pass null now fail earlier → intended
  missing-session invariant, with the same existing diagnostic.
- Malformed nonnull objects are outside this repair → authenticated-session
  construction and role middleware remain the owning validation boundaries.

## Migration Plan

No migration, dependencies, configuration or feature flags. Report lifecycle,
destructive database guards and the seven canonical middleware chains are
unchanged. No app/web or external API scope changes.
