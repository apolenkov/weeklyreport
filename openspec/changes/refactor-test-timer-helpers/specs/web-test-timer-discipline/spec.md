## ADDED Requirements

### Requirement: Web tests wait on framework primitives, not hand-rolled tick loops

Test files under `apps/web/src` MUST NOT define or call hand-rolled
promise-tick flush helpers (flushAll-style loops of
`await Promise.resolve()` with `setTimeout(0)` hops). Fake-timer tests
MUST advance time with Vitest async timer APIs
(`vi.advanceTimersByTimeAsync(n)` for timing-semantics assertions,
`vi.runAllTimersAsync()` only as a terminal drain). Real-timer
component tests MUST wait with Testing Library `findBy*` / `waitFor`
anchored on an observable condition.

#### Scenario: scanning the web test suite for tick-flush helpers

- **WHEN** `grep -rn "flushAll" apps/web/src` runs at HEAD
- **THEN** it returns no matches
- **AND** no `for (...) await Promise.resolve()` tick loop exists in
  any `apps/web` test file

#### Scenario: a fake-timer test settles the autosave debounce

- **WHEN** the autosave hook test elapses the 3000 ms debounce window
- **THEN** it awaits `vi.advanceTimersByTimeAsync(3000)` inside
  `act()` and asserts the exact settled state, with no trailing
  microtask flushing

### Requirement: Testing Library waits and Vitest fake timers never mix

A web test file that enables `vi.useFakeTimers()` MUST NOT use Testing
Library `waitFor` / `findBy*` waits: with `globals: false` in
`apps/web/vitest.config.ts` and no `jest` shim in
`apps/web/vitest.setup.ts`, Testing Library's polling timer is itself
faked and the wait deadlocks until test timeout. Such files MUST use
`vi.*` timer primitives inside `act()` instead.

#### Scenario: a hook test needs both fake timers and a settled query cascade

- **WHEN** a fake-timer test must settle a TanStack Query
  mutation/notify cascade
- **THEN** it drains via `await vi.advanceTimersByTimeAsync(0)` (or a
  terminal `vi.runAllTimersAsync()`), never via Testing Library
  `waitFor`

### Requirement: Negative wait assertions are anchored on a positive signal

A negative assertion after an async cascade MUST follow a positive
readiness anchor — `not.toHaveBeenCalled`, `not.toBeInTheDocument`,
and `toHaveLength(0)` come only after a `findBy*` / `waitFor`
condition that proves the cascade settled — never a bare drain or a
`waitFor` wrapped around the negative itself.

#### Scenario: asserting a head session never fires the lead query

- **WHEN** the addressable-route test verifies a head session is
  redirected away from the lead form
- **THEN** it first waits for the router `replace` spy to be called
  with the head path
- **AND** only then asserts `byPeriodQuery` was not called
