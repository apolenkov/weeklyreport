# Design

## Context

See proposal.md for the failure path. The email worker catches `unknown` after
dispatch and formats it before either reminder lifecycle update. The shared
helper already defines `Unknown error` for messages without useful text.

## Goals / Non-Goals

**Goals:** preserve the existing reminder retry and final-failure invariants
when inspecting or stringifying the rejected value itself fails.

**Non-Goals:** change message selection for values that already convert
successfully, introduce a production test seam, or prove PostgreSQL persistence
through a mocked unit test.

## Decisions

Guard the existing normalization in the shared helper. A conversion failure
returns its existing fallback, allowing every current consumer to continue
its error path. Fixing each worker separately would leave the same defect in
enqueue, health, PDF, and scheduler consumers.

Before: adapter rejection -> formatter throws -> lifecycle update is skipped.
After: adapter rejection -> fallback -> claim release or terminal failure ->
the original rejection is rethrown.

Extend the existing worker table cases instead of introducing helper-only
tests: the regression must show that lifecycle calls run and the original
rejection survives. Both final and intermediate attempts are distinct
observable outcomes. Existing blank-message cases remain their primary proof.

The period lifecycle tuple, canonical authorization middleware and destructive
database guard are unaffected. No migration or runtime configuration changes
are required.

## Risks / Trade-offs

- A broken conversion loses its diagnostic text -> retain the existing stable
  fallback and rethrow the original adapter rejection.
- Worker unit tests mock persistence -> report them as worker behavior only;
  do not claim database integration acceptance.

## Migration Plan

Deliver the helper and worker regression together after the six repository
gates and independent review. Rollback is the normal commit reversal.
