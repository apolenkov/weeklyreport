## ADDED Requirements

### Requirement: Spies and mocks are restored between tests

Test spies and mocks MUST be restored to their original implementations between
tests so a spy installed in one test cannot leak into another. The web suite
MUST enable restoration globally (`restoreMocks: true` in
`apps/web/vitest.config.ts`, or an `afterEach(() => vi.restoreAllMocks())`), and
the api test-utils `silenceStderr` / `silenceNestLogger` in
`apps/api/src/test-utils/silence-logs.ts` MUST restore the spies they install
rather than relying on `clearAllMocks` (which does not restore).

#### Scenario: a logger-silencing spy does not cross test boundaries

- **GIVEN** a test calls `silenceStderr` or `silenceNestLogger` which installs a
  spy
- **WHEN** that test finishes and the next test runs
- **THEN** the spy has been restored and the next test observes the original
  implementation
- **AND** the suite relies on restoration, not on `clearAllMocks`, to undo it

### Requirement: Test-util documentation matches the code

Test-utility docstrings MUST name only helpers that exist and describe what the
code actually does. The `apps/api/src/test-utils/mailpit.ts` docstring MUST NOT
reference a non-existent `pollMailpit`, and any docstring claiming a mock layer
"backs" tests MUST be true of the wired code.

#### Scenario: a docstring names a helper that does not exist

- **GIVEN** the mailpit test-util docstring references `pollMailpit`
- **WHEN** the cleanup runs and grep finds no such export
- **THEN** the docstring is corrected to name the helper that exists
