# critical-integrity-repair-gate Specification

## Purpose

Define the fail-closed evidence contract that keeps every accepted P0 integrity
repair executable, directly tested, and resistant to advisory or stale proof.

## Requirements

### Requirement: Every accepted P0 finding has executable resolution evidence

The repository MUST maintain a machine-readable manifest covering exactly the 13 P0 finding ids from the exhaustive audit. Each entry MUST name its owning files, governing capability, positive tests, adversarial negative probes, and canonical gate command; no entry may be marked resolved unless every referenced artifact exists and passes.

#### Scenario: Evidence manifest is complete

- **WHEN** the critical-integrity verifier runs on the completed change
- **THEN** it finds each of the 13 accepted P0 ids exactly once and every referenced test, probe, spec, and owner exists

#### Scenario: A finding has only indirect evidence

- **WHEN** a manifest entry cites a broad green suite without a direct positive assertion and planted negative probe
- **THEN** the verifier fails and keeps that finding unresolved

### Requirement: Critical tests cannot be advisory

Tests referenced by the P0 evidence manifest MUST execute in their canonical local gate and MUST NOT use todo, skip, fixme, focused, or conditional early-return markers.

#### Scenario: Critical test is disabled

- **WHEN** a referenced SAML, PDF, lifecycle, concurrency, lead-state, or restore test is marked todo, skip, fixme, focused, or conditionally bypassed
- **THEN** the critical-integrity verifier fails before reporting the P0 queue complete
