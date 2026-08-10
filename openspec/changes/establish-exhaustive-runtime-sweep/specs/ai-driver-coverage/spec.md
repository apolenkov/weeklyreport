## MODIFIED Requirements

### Requirement: Native AI review is bound to deterministic role coverage

Every role-reachable catalog (`lead`, `head`, `admin`, `viewer`) SHALL be
covered by the deterministic Playwright project chain. A required supplemental
native Codex `gpt-5.6-luna` Max review SHALL consume each canonical role/profile
route evidence batch after that chain, but it SHALL emit candidates only and never
mutate deterministic cells or the canonical ledger. Every imported report SHALL
declare `provider: native-codex`, `model: gpt-5.6-luna`, `reasoning: max`, the
campaign source SHA, seed/profile, role, route, deterministic state, action,
and oracle cell before it runs. Reports and candidate findings SHALL reference
exact cell ids. Every report SHALL carry a nonempty `attemptId` and nonempty
transcript/tool-event evidence refs with `transcriptEvidence.status: captured`;
a native report without capture evidence fails closed. An explicit read-only
verifier/import SHALL disposition every candidate; missing or unused
verification fails closed. Within-route exploration remains run-time coverage
and is not frozen into a per-element spec.

#### Scenario: Each role has a verified capture path

- **WHEN** the deterministic projects and required native AI review cover a
  role's catalog
- **THEN** the projects drive every declared catalog route in live Chromium at
  1440x900, while any AI report records the canonical source SHA/profile and
  exact coverage cells
- **AND** an injected console canary is detected during the run, proving the
  capture path is live, while Firefox, WebKit, mobile, and tablet remain
  explicit exclusions
- **AND** the per-role report names each anomaly by cell id, role, route, and
  anomaly kind

#### Scenario: Confirmed findings are dispositioned and bound to evidence

- **WHEN** the explicit adversarial-verifier import classifies a candidate
- **THEN** a seed or test artifact is dismissed with a recorded reason, and a
  confirmed bug is fixed with a test, deferred with an explicit reason, or
  split into its own change
- **AND** the disposition records the candidate's source SHA, profile, role,
  route, state, action, oracle, evidence links, and terminal verdict in the
  canonical ledger

#### Scenario: A report from the wrong SHA cannot satisfy coverage

- **WHEN** an AI report or candidate references a source SHA, profile, or
  coverage cell different from the active campaign ledger
- **THEN** import rejects the artifact as stale and the affected cell remains
  uncovered until rerun against the active SHA

#### Scenario: Review scope is bounded and reproducible

- **WHEN** the same campaign manifest and deterministic profile are reviewed
  more than once
- **THEN** deterministic projects consume the same finite route/state/action
  matrix and native AI reports reference comparable cell identities, while
  semantic observations may add candidates without expanding the declared
  browser or viewport scope
- **AND** an empty-candidate result is trusted only when the canary, applicable
  environment evidence, and all required deterministic cell evidence are
  present
