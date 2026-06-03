# Deterministic compiled UI gate over agent-interpreted scenarios

Static gates (typecheck/lint/test/build) have shipped a runtime regression
before (an autofix turned DI-injected classes into `import type` and broke
NestJS boot), so we need a behavioral UI gate. We decided the gate is a set of
**deterministic Playwright specs compiled from canonical Gherkin `.feature`
files** (a Haiku fan-out authors the specs once per scenario), run per role via
the `dev-auth` login — NOT an LLM agent interpreting the scenarios live on every
run.

Why: a regression gate must give the same verdict for the same code. An agent
driving the browser each run is non-deterministic (flaky red can't be told from
a real regression), expensive on every CI trigger, non-reproducible (no stack
trace to bisect), and "helpful" enough to work around a real bug and report
success — masking the very regressions the gate exists to catch. Compiled specs
cost LLM tokens once, then run deterministically and for free.

Agent interpretation is kept for what it is good at — **discovery** ("explore
as admin, report anything odd") and **authoring** (turning a `.feature` into a
spec) — never as the recurring gate.

## Considered Options

- **Agent-interpreted live (rejected as the gate):** flexible, no step
  definitions, but non-deterministic, costly per run, unbisectable, and masks
  regressions. Fine for discovery/authoring only.
- **Code-location coverage catalog (deferred):** binds scenarios to
  `file:line`; the links rot on the first refactor on an unstable MVP codebase.
  Parked in `establish-scenario-catalog` until the code stabilizes.

## Consequences

- The canonical source of truth is behavioral Gherkin `.feature` (role + route +
  Given/When/Then), not code-anchored. See [[Behavioral Scenario]] in CONTEXT.md.
- The current UI e2e harness under `e2e/` is removed for now and regenerated
  from the canonical `.feature`; the hard-won `dev-auth` role-login plumbing is
  recoverable from git history, not re-derived. Integration and unit tests stay.
