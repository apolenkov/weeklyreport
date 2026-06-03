---
status: accepted (supersedes the earlier "deterministic-compiled-gate-first" draft of this ADR)
---

# Live exploratory UI sweep now, deterministic frozen specs later

Static gates (typecheck/lint/test/build) are provably blind to a class of
runtime regression — an autofix once turned DI-injected classes into
`import type` and broke NestJS boot while every static gate stayed green — so we
need a behavioral UI gate. The codebase is a pre-prod MVP that refactors
constantly.

We decided to **split the behavioral UI check into two phases by product
stability**, instead of building one deterministic compiled gate up front (which
the first draft of this ADR proposed, and which we now reject):

- **Phase 1 (now) — live exploratory sweep, non-blocking report.** A durable,
  high-level **Scenario Catalog** (`roles × routes × intents`, generated from the
  code+DOM entry-point surface by a Haiku fan-out, then human-reviewed) is
  executed by a swappable **Driver** — a human (manual checklist) or an AI agent
  driving the browser via Playwright MCP through `/auth/dev-login`. Exhaustive
  coverage ("every element, every transition") is the **agent's run-time job**,
  not a frozen list in the catalog. The output is a per-role report of what is
  broken (console errors, broken DOM/flow, layout, axe a11y). It does **not**
  block merges.
- **Phase 2 (deferred, once the product stabilizes) — frozen deterministic
  gate.** Only the **critical, stabilized** Behavioral Scenarios are compiled
  once into deterministic Playwright `*.spec.ts` and run with no LLM in the run
  path, as a blocking regression gate. Not exhaustive — exhaustive freezing is
  neither viable nor needed.

## Why

A regression _gate_ must be deterministic (same code → same verdict), so a live
agent can't be the **gate**. But phase 1 is a **report**, not a gate — and for a
report, an agent's non-determinism is a feature, not a defect. The earlier draft
optimized phase-2 determinism for what is actually a phase-1 reporting job, and
in doing so it would have frozen an exhaustive structural catalog on a churning
MVP — exactly the brittleness that rots.

The split is the documented industry best practice, confirmed by research:

- **Scripted / exhaustive catalogs rot on a changing codebase.** "Each time the
  design or functionality changes, the corresponding scripts must be updated";
  brittleness comes from coupling tests to DOM structure; "hundreds of tests on
  an old button ID → a rename is a massive cleanup."
- **Exploratory / agent testing is adaptive and finds unknown-unknowns.** It is
  "flexible and adaptive to changes" and surfaces "creative, obscure, often more
  severe bugs a rigid script would miss." Autonomous AI exploratory testing
  became "a production discipline, not an experiment" in 2026, gives ~80–90%
  coverage out of the box, and self-heals by intent rather than CSS selector.
- **Best practice is to combine the two by phase** — exploratory for discovery
  now, scripted for regression once paths stabilize. That is exactly this split.

## Considered Options

- **Exhaustive frozen catalog up front (rejected):** structure-anchored, rots on
  the first refactor of an MVP, and imposes a human-review tax on every change.
- **Agent-interpreted live as the blocking gate (rejected as the gate, kept as
  the phase-1 reporter):** non-deterministic, so unfit to block merges; ideal for
  discovery and reporting.
- **External agentic-testing product (Aximo / TestSprite) (rejected):** mature
  vision/self-healing, but external dependency, cost, lock-in, and data leaving
  the app. We own the driver on the Playwright MCP + Workflow we already run.
- **Formal Model-Based Testing state model (deferred to phase 2):** heavyweight
  to author and also rots on an MVP; a live exploring agent finds transitions
  without one. It earns its keep only for the deterministic phase-2 gate.
- **`file:line` Coverage Catalog / drift gate (deferred):** links rot on the
  first refactor; parked in `establish-scenario-catalog` until the code
  stabilizes.

## Consequences

- The canonical source of truth is the behavior-anchored Scenario Catalog (role +
  route + intent + Given/When/Then), not code-anchored. See [[Behavioral
Scenario]], [[Scenario Catalog]], [[Driver]], [[Role sweep]] in CONTEXT.md.
- **Phase 1 does not stop the origin-class bug.** A non-blocking report means the
  same `import type` autofix would still merge green unless a human reads the
  report. A blocking guarantee arrives only with the phase-2 frozen gate. This is
  accepted knowingly.
- The current UI e2e harness under `e2e/` is regenerated from the catalog; the
  hard-won `dev-auth` role-login plumbing is recovered from git history, not
  re-derived. Integration and unit tests stay.

## Sources

- Exploratory vs scripted, maintenance trade-offs —
  <https://testrigor.com/blog/exploratory-testing-vs-scripted-testing-tell-them-apart-and-use-both/>
- Autonomous exploratory AI testing —
  <https://testquality.com/autonomous-exploratory-testing-ai-agents/>
- Agentic testing as 2026 production discipline —
  <https://vtestcorp.com/insights/agentic-testing-the-complete-guide-to-ai-powered-software-testing-in-2026/>
- Brittle UI tests / maintainable suites —
  <https://shiftasia.com/column/how-to-design-maintainable-automated-test-suites/>
- Model-based testing trade-offs —
  <https://abstracta.us/blog/software-testing/model-based-testing-using-state-machines/>
