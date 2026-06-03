## Context

Static gates have shipped a runtime regression before (autofix → `import type` →
broken NestJS DI), so a behavioral UI check is needed. An earlier attempt built a
full AI `Coverage Catalog` (scenarios bound to `file:line`) and removed it as
premature — the links rot on an MVP. The reusable bits survive: the catalog
generator Workflows (parked in `establish-scenario-catalog`) and a working
per-role login helper (`dev-auth`, currently under `e2e/`). The decision record
is `docs/adr/0001`; terms are in `CONTEXT.md` (Behavioral Scenario, Scenario
Catalog, Driver, Role sweep, Coverage Catalog).

## Goals / Non-Goals

**Goals:**

- A durable, behavior-anchored **Scenario Catalog** (`role × route × intent`)
  that survives refactors.
- A swappable **Driver** (human checklist or AI agent on the Playwright MCP) that
  runs the catalog per role and reports anomalies — phase 1, non-blocking.
- Generate the catalog from **code** — the role's reachable routes + their
  page/action components + SSR guards (Haiku fan-out + completeness critic), not
  by hand. DOM is the Driver's run-time concern, never the generator's.

**Non-Goals:**

- The `file:line` Coverage Catalog / drift gate (stays deferred in
  `establish-scenario-catalog`).
- The deterministic **frozen** Playwright gate and formal Model-Based Testing
  (both phase 2, deferred until the product stabilizes).
- Re-deriving `dev-auth` from scratch (restore from git).
- A negative-authz / denial matrix. The access boundary is a backend concern
  (tRPC `role-coverage-gate` + SSR guards); a per-role catalog lists only
  reachable routes. The Driver reports an _unexpected_ denial as an anomaly, but
  the catalog enumerates no "role X denied route Y" grid.

## Decisions

- **Catalog is durable + high-level, not exhaustive (the load-bearing choice).**
  Exhaustive enumeration of every element/state/transition is structure-anchored
  and rots almost as fast as `file:line`. The catalog stores `role × route ×
intent` only; the exhaustive "every element, every transition" coverage is
  produced by the **live agent exploring at run time**. Research backs the split:
  scripted/exhaustive suites are costly to maintain on a churning codebase, while
  autonomous exploratory AI testing is adaptive, finds unknown-unknowns, and
  gives ~80–90% coverage out of the box (ADR 0001 sources).
- **Two levels of completeness, on two layers.** "ВСЕ" splits: Layer-1
  completeness is **entry-point coverage** — every `role × route` has ≥1 intent
  scenario — verified by the generation-time critic + coverage matrix.
  Layer-2 exhaustiveness is **within-route** — every interactive element and
  reachable transition — produced and measured by the Driver **at run time**, not
  frozen in the catalog. The critic does NOT chase per-element completeness (that
  would re-introduce the rotting structural list); it only guards entry points.
- **Live Driver now; deterministic frozen specs later (phased by stability).** A
  blocking gate must be deterministic, so a live agent can't be the gate — but
  phase 1 is a **report**, where the agent's non-determinism is fine. Phase 2
  freezes only critical, stabilized scenarios into Playwright specs.
- **YAML skeleton + Given/When/Then prose, no BDD runner.** The catalog skeleton
  is machine-generated and human-reviewable as structured rows; the expected
  outcome is plain Given/When/Then text the Driver (human or agent) reads. The
  repo has no `playwright-bdd`/cucumber and adds none.
- **Generate via Haiku fan-out, one agent per route.** Slicing blindly per file
  yields junk (files with no UI) and duplicates (many files back one screen); the
  route is the natural slice. A large page (e.g. `LeadForm` is ~1900 lines) is
  handled by instructing the agent to navigate to the action surface — the tRPC
  mutation call-sites and action components — rather than reading linearly or
  line-group sub-slicing (which would re-introduce structural coupling). A
  completeness-critic + coverage matrix make "covered everything" justified at
  the entry-point level, not asserted.
- **Own the Driver on the Playwright MCP + Workflow.** We already run both, plus
  `dev-auth` and the VA-0a Haiku-fan-out experience. An external agentic-testing
  product adds cost, lock-in, and data egress for no phase-1 benefit.
- **Reuse, don't fork, the generator.** Retarget `establish-scenario-catalog`'s
  generator output to the YAML skeleton and drop its `file:line` binding; that
  change keeps the deferred `file:line` catalog, this change owns the behavioral
  path + Driver.
- **Role order: `lead` first.** Largest UI surface; prove the pipeline on one
  slice before fanning out to `head` / `admin` / `viewer`.

## Risks / Trade-offs

- **Phase 1 does not stop the origin-class bug.** A non-blocking report means the
  same `import type` autofix still merges green unless a human reads the report.
  → Accepted knowingly; the blocking guarantee is phase 2. The sweep must at
  least surface a boot/load failure loudly (failed load + console errors).
- **Generated catalog can miss surface or emit junk.** → completeness-critic +
  coverage matrix + human review of the generated diff; same guardrail proven on
  VA-0a (self-verify + sampled adversarial vacuity review).
- **The catalog is regenerated, not permanent.** → that is the point: cheap Haiku
  regeneration + reviewed diff beats maintaining a rotting exhaustive list. The
  durable `intent` layer changes rarely; only the run-time exploration tracks the
  churn.
- **Removing `dev-auth` loses the cookie/role logic.** → it is committed; restore
  from git history rather than re-derive.

## Migration Plan

1. Land the durable `lead` Scenario Catalog (YAML skeleton + GWT prose), generated
   from the entry-point surface and human-reviewed.
2. Restore `dev-auth` from git into the regenerated sweep harness; wire
   `pnpm test:uat`.
3. Build the Driver: agent mode on the Playwright MCP (per-role, reads the
   catalog, explores, reports) and a human checklist mode; run the `lead` sweep
   and produce a report.
4. Remove the old UI e2e harness + `test:e2e`/`test:e2e:ui` scripts.
   Rollback: `git revert`/restore the removed `e2e/` files.

## Open Questions

- Final home/naming for the YAML catalog (`e2e/catalog/<role>.yaml`?) and the
  Driver/sweep entry point — settle during apply.
- Exact report format/location for the per-role sweep (Markdown summary?
  per-role file?) — settle during apply.
- Whether `head`/`admin`/`viewer` land in this change or follow-ups once `lead`
  proves the pipeline.
