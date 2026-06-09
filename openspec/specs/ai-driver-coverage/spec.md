## Purpose

The AI-agent exploratory Driver pass is the behavioral safety net that the
automated Layer-1 sweep cannot provide: it walks each role's catalog in a live
browser, observes within-route flow/logic against the documented `then`, and
surfaces contradictions a load-and-axe sweep is blind to. This capability fixes
the durable coverage property — every role-reachable catalog is driven, the
console-capture path is proven live on each run, and every confirmed finding is
dispositioned — without freezing the run-time scenarios themselves into specs
(see ADR 0001). It governs the regression process, not a code module.

Consumer surfaces: the shared drive protocol (`e2e/sweep/driver/`), the
per-role oracle catalogs (`e2e/catalog/{lead,head,admin,viewer}.yaml`), the
adversarial-verify workflow, and the per-role driver reports under
`e2e/sweep/.reports/`.

## Requirements

### Requirement: AI-Driver exploratory pass covers every role's catalog

Every role-reachable catalog (`lead`, `head`, `admin`, `viewer`) SHALL be
covered by the AI-agent exploratory Driver pass — i.e. no role's catalog is
left undriven once the role is scoped. The pass reuses the shared drive protocol
and the adversarial-verify workflow rather than a per-role fork; whenever it
runs, its console-capture path SHALL be proven live (so an empty finding list is
trustworthy), and every confirmed finding SHALL be dispositioned. This is a
durable coverage property the regression process maintains as catalogs change;
it specifies coverage only — the within-route scenarios stay run-time and are
NOT frozen into specs (see ADR 0001).

#### Scenario: Each role is driven with a verified capture path

- **WHEN** the AI-Driver runs a role's catalog
- **THEN** it drives every catalog route in a live browser via the Playwright MCP
- **AND** an injected console canary is detected during the run, proving the
  capture path is live (so an empty finding list means "clean", not "blind")
- **AND** the per-role report names each anomaly by role · route · anomaly

#### Scenario: Confirmed findings are dispositioned, artifacts are dismissed

- **WHEN** the adversarial-verify workflow classifies a candidate finding
- **THEN** a seed or test artifact is dismissed with a recorded reason
- **AND** a confirmed bug is dispositioned: fixed with a test, deferred with a
  reason, or split into its own change
