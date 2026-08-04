## MODIFIED Requirements

### Requirement: AI-Driver exploratory pass covers every role's catalog

Every role-reachable catalog (`lead`, `head`, `admin`, `viewer`) SHALL be
covered by the bounded AI-agent exploratory Driver pass once the role is scoped.
Each drive SHALL declare the campaign's canonical source SHA, seed/profile,
role, route, deterministic state, action, and oracle cell before it runs, and
the Driver's report and candidate findings SHALL reference those cell ids in
the single evidence ledger. The pass SHALL reuse the shared drive protocol and
the adversarial-verify workflow rather than a per-role fork; whenever it runs,
its console-capture path SHALL be proven live, and every candidate SHALL be
dispositioned with evidence. Within-route exploration remains run-time coverage
and is not frozen into a per-element spec.

#### Scenario: Each role is driven with a verified capture path

- **WHEN** the AI-Driver runs a role's catalog
- **THEN** it drives every declared catalog route in a live Chromium browser at
  1440x900 and records each drive under the canonical source SHA/profile and
  coverage cell
- **AND** an injected console canary is detected during the run, proving the
  capture path is live, while Firefox, WebKit, mobile, and tablet remain
  explicit exclusions
- **AND** the per-role report names each anomaly by cell id, role, route, and
  anomaly kind

#### Scenario: Confirmed findings are dispositioned and bound to evidence

- **WHEN** the adversarial-verify workflow classifies a candidate finding
- **THEN** a seed or test artifact is dismissed with a recorded reason, and a
  confirmed bug is fixed with a test, deferred with an explicit reason, or
  split into its own change
- **AND** the disposition records the candidate's source SHA, profile, role,
  route, state, action, oracle, evidence links, and terminal verdict in the
  canonical ledger

#### Scenario: A drive from the wrong SHA cannot satisfy coverage

- **WHEN** a Driver report or candidate references a source SHA, profile, or
  coverage cell different from the active campaign ledger
- **THEN** verification rejects the artifact as stale and the affected cell
  remains uncovered until rerun against the active SHA

#### Scenario: Driver scope is bounded and reproducible

- **WHEN** the same campaign manifest and deterministic profile are driven more
  than once
- **THEN** the Driver consumes the same finite route/state/action matrix and
  emits comparable cell identities, while semantic observations may add
  candidates without expanding the declared browser or viewport scope
- **AND** the empty-candidate result is trusted only when the canary and all
  required cell evidence are present
