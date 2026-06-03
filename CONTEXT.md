# CustomReport

Weekly status reports for a software department: leads fill structured
report sections, the head reviews/publishes/exports a unified report. This
glossary fixes terms that have been ambiguous or overloaded in the codebase.

## Testing & scenarios

**Behavioral Scenario**:
A human-readable description of observable behavior for a role on a route —
`role + route + Given/When/Then + expected outcome`. Anchored to what the user
sees, NOT to a code location, so it survives refactors. The durable source of
truth for UI tests; compiled to deterministic Playwright specs.
_Avoid_: feature file (as a synonym for the catalog), test case, story.

**Coverage Catalog**:
A generated map binding each scenario to the `file:line` of the code it
exercises, to detect uncovered entry-point surface. Brittle on an unstable
codebase (the `file:line` links rot on the first refactor); deliberately
deferred until the code stabilizes. Distinct from a Behavioral Scenario.
_Avoid_: scenario catalog (when you mean the durable behavioral specs).

**Role sweep**:
A per-role pass (`lead` / `head` / `admin` / `viewer`, via `/auth/dev-login`)
that exercises that role's Behavioral Scenarios in a live browser and asserts
0 console errors plus the expected DOM. The reusable UI regression gate.
_Avoid_: smoke test, e2e run (too generic).
