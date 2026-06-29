## ADDED Requirements

### Requirement: No dead parallel HTTP-mock layer exists alongside createMockTRPC

A parallel HTTP-mock layer MUST NOT sit dead in the web suite implying it backs
tests when it never fires; web component tests stub tRPC through `createMockTRPC`
(per this capability), so any second mock layer must fire-or-be-removed. The MSW
layer in
`apps/web/src/test-utils/msw-handlers.ts` (wired in
`apps/web/vitest.setup.ts`) MUST either fire — its `API_URL`
points at the jsdom origin, `onUnhandledRequest` no longer silently bypasses, the
POST handler returns the correct tRPC batch shape, the factories are typed with
`satisfies` so schema drift surfaces (e.g. the removed `priorities` field), and a
test actually relies on it — or be removed entirely as unused.

#### Scenario: the MSW layer is honest about whether it backs tests

- **GIVEN** the MSW handlers currently listen on a port the client never targets
  and `onUnhandledRequest: 'bypass'` hides it, so no test exercises them
- **WHEN** the cleanup runs
- **THEN** either MSW is repointed at the jsdom origin with a corrected batch
  shape, typed factories, and a test that depends on it, or `msw-handlers.ts`
  plus its setup wiring are deleted
- **AND** no mock layer remains that comments claim backs tests but that never
  executes

#### Scenario: a test-only factory matches the current schema

- **GIVEN** a retained test factory such as `createMockSection`
- **WHEN** the schema drops a field (e.g. `priorities`)
- **THEN** the factory is typed with `satisfies` so the stale field fails
  typecheck rather than silently emitting a removed field
