# Proposal

## Why

The API coverage configs retain an exclusion already covered by their broader test-file pattern. The role denial comment also describes unauthenticated coverage that the dedicated FORBIDDEN event does not provide.

## What Changes

- Remove the redundant integration-test pattern only from both coverage exclusion lists.
- Describe authenticated wrong-role denials and the existing outer logging of null-session attempts.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. `skip_specs: true` applies because behavior and requirements remain unchanged.

## Impact

`apps/api/vitest.config.ts`, `apps/api/vitest.coverage.config.ts`, and one comment in `trpc.middleware.ts`. Exact cards and original clauses are retained in the external D37-F05 BRIEF and candidate-verdicts artifacts.

## Non-goals

- Coverage denominator, branches threshold, test discovery, dotenv runner or seriality changes.
- Authorization, roleDenied event policy, boot reporting policy or native acceptance changes.
