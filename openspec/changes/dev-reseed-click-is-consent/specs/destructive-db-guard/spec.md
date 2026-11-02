## ADDED Requirements

### Requirement: The dev reseed action supplies its own per-run consent

In dev mode, an authenticated `wipeAndReseed` invocation with an explicitly chosen
variant MUST count as the operator's per-run consent. The procedure MUST pass the
exact consent value to its destructive-target check and to its reset and seed child
processes, without writing it into the API process environment. The disposable-target
allowlist, the production refusal, the dev-mode gate and the one-at-a-time lock MUST
still apply, and every other destructive script or CLI path MUST keep requiring the
consent in its own environment.

#### Scenario: Reseed from the dev role switcher without server-wide consent

- **GIVEN** the API runs in dev mode against an allowlisted disposable target and its environment has no consent value
- **WHEN** an authenticated operator triggers `wipeAndReseed` with a variant
- **THEN** the reset and seed children run with the exact consent value
- **AND** the API process environment still has no consent value afterwards

#### Scenario: The click never widens the target allowlist

- **GIVEN** the API runs in dev mode against a non-allowlisted database
- **WHEN** an authenticated operator triggers `wipeAndReseed`
- **THEN** the call is refused before any child process starts
