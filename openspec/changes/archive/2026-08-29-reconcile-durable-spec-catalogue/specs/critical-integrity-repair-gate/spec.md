## REMOVED Requirements

### Requirement: Every accepted P0 finding has executable resolution evidence

**Reason**: This contract describes the closed 13-finding P0 audit manifest rather than an independent product capability. The implemented properties now belong to their domain specifications, while the original manifest and evidence remain in the archived `2026-08-04-repair-exhaustive-audit-critical-integrity` change.

**Migration**: Keep the behavioural requirements in `period-dual-state`, `report-section-write-gates`, `destructive-db-guard`, and the other owning domain specifications; use the archived change only as provenance for the original P0 manifest.

The repository MUST maintain a machine-readable manifest covering exactly the 13 P0 finding ids from the exhaustive audit. Each entry MUST name its owning files, governing capability, positive tests, adversarial negative probes, and canonical gate command; no entry may be marked resolved unless every referenced artifact exists and passes.

#### Scenario: Evidence manifest is complete

- **WHEN** the critical-integrity verifier runs on the completed change
- **THEN** it finds each of the 13 accepted P0 ids exactly once and every referenced test, probe, spec, and owner exists

#### Scenario: A finding has only indirect evidence

- **WHEN** a manifest entry cites a broad green suite without a direct positive assertion and planted negative probe
- **THEN** the verifier fails and keeps that finding unresolved

### Requirement: Critical tests cannot be advisory

**Reason**: This is a historical enforcement rule for one P0 campaign, not a standalone runtime contract. Required verification is already governed by `uat-quality-gates` and the executable `pnpm lint` orchestrator.

**Migration**: Preserve concrete tests and evidence under their owning domain specifications and standard gates (`pnpm typecheck`, `pnpm lint`, and `pnpm test`) instead of maintaining a separate P0 campaign capability.

Tests referenced by the P0 evidence manifest MUST execute in their canonical local gate and MUST NOT use todo, skip, fixme, focused, or conditional early-return markers.

#### Scenario: Critical test is disabled

- **WHEN** a referenced SAML, PDF, lifecycle, concurrency, lead-state, or restore test is marked todo, skip, fixme, focused, or conditionally bypassed
- **THEN** the critical-integrity verifier fails before reporting the P0 queue complete
