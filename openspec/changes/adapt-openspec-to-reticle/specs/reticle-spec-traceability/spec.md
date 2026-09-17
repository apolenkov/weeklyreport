## Purpose

Define complete, drift-detecting traceability between WeeklyReport's normative OpenSpec outcomes and the browser or deterministic evidence that proves each outcome.

## ADDED Requirements

### Requirement: The registry covers exact scenario and normative outcome denominators

The repository MUST derive the accepted source snapshot's scenario denominator from every `#### Scenario:` nested under a `### Requirement:` in `openspec/specs/*/spec.md`. It MUST also derive every normative outcome introduced by `THEN` and each following `AND` clause. The version 2 coverage registry MUST contain exactly one source entry for every derived outcome, preserving its structured identity, exact text and ordinal, and fingerprints of the normalized parent and outcome text. A source outcome MUST NOT be split into additional entries to obtain separate proofs.

Consumer surfaces: `openspec/specs/*/spec.md`, the tracked Reticle coverage registry, and the repository Reticle coverage gate.

#### Scenario: A normative scenario is added or changed

- **WHEN** a requirement or scenario is added, removed, renamed, or its normative text changes
- **THEN** the coverage gate fails until the exact scenario outcomes and fingerprints are reviewed and updated

#### Scenario: A title is reused elsewhere

- **WHEN** two scenarios have the same title under different specifications or requirements
- **THEN** the gate treats them as distinct scenarios using their structured specification, requirement, and scenario identity

### Requirement: Every normative outcome has honest required proofs

Every registry outcome MUST remain one source entry with either `coverage.kind: "unclassified"` during inventory/review or `coverage.kind: "classified"` with a non-empty `proofs` array at acceptance. Each proof MUST be either a Reticle proof containing `flow`, `assertion`, and `consequence`, or a deterministic proof containing `surface` and `detail`; every proof is required to establish its separate sub-guarantee. An unavailable environment, missing fixture, failing flow, or product defect MUST NOT move an applicable browser proof to a deterministic proof. Outcomes from the same scenario MAY require different proof kinds, and no proof MAY claim a sibling sub-guarantee it cannot establish.

Consumer surface: the tracked Reticle coverage registry and its review workflow.

#### Scenario: A server-only contract has no browser consequence

- **WHEN** a normative scenario can only be established by a server, database, deployment, static-source, performance, or operational check
- **THEN** the registry classifies that outcome with one or more concrete deterministic proofs, each naming its evidence surface and detail

#### Scenario: A browser scenario cannot currently run

- **WHEN** a user-facing browser scenario lacks a usable fixture, exposes a product defect, or cannot reach a live Reticle verdict
- **THEN** the registry keeps the applicable proof Reticle-required and reports the classified outcome as incomplete until that proof passes

#### Scenario: One scenario mixes browser and internal guarantees

- **WHEN** one scenario contains browser-visible outcomes and outcomes about source structure, persistence, transactions, or hidden writes
- **THEN** the registry keeps one source entry for each parsed normative outcome and records all required browser and deterministic proofs on the applicable entry
- **AND** no browser verdict counts as proof of an internal sub-guarantee, while deterministic tests cannot replace an applicable browser proof

### Requirement: Reticle proofs identify a meaningful saved consequence

Every Reticle proof in a classified outcome MUST name a saved flow and the specific consequence assertion within that flow which proves its sub-guarantee. The flow MUST carry a non-empty business intent and a consequence-grade assertion. The installed Reticle core 2.14 qualifies only `signal`, `net`, and `state`; `console` and `text` MAY be supplemental but MUST NOT qualify alone, and a route MAY be asserted through real registered state. An action-only flow or element-presence-only check MUST NOT satisfy the proof.

Consumer surfaces: `.reticle/flows/<project-id>/*.json`, the tracked Reticle coverage registry, and the repository Reticle coverage gate.

#### Scenario: Several scenarios share one sufficient flow

- **WHEN** one flow contains distinct consequence assertions that establish several normative scenarios
- **THEN** each outcome MAY reference that flow through one or more proofs, but each Reticle proof MUST identify the assertion that proves its own sub-guarantee

#### Scenario: A mapped flow loses its assertion or intent

- **WHEN** a referenced flow, business intent, required proof, or consequence assertion is missing or no longer matches the registry locator
- **THEN** the Reticle coverage gate fails

### Requirement: Static traceability and live proof remain separate

Static registry validation MUST NOT record or imply a current runtime pass. Completion evidence for every required Reticle proof and each distinct mapped flow MUST include a live Reticle verdict of `verified: yes` produced from a consequence declared before its action and a successful replay on the sources being accepted. `unknown`, `no-fault`, skipped, failed, or stale results MUST NOT count as proof. Each outcome counts once in the outcome denominator; Reticle-proof and deterministic-proof outcome counts MAY overlap, and the acceptance summary MUST expose mixed-outcome count and total proof count.

Consumer surfaces: the repository Reticle coverage gate, native Reticle verification tools, and task acceptance evidence.

#### Scenario: The registry is complete but a replay fails

- **WHEN** static coverage validation passes and any mapped flow lacks a current successful live verdict or replay
- **THEN** Reticle acceptance remains incomplete without moving that outcome to a deterministic surface

#### Scenario: All distinct mapped flows pass

- **WHEN** static coverage validation passes and every distinct mapped flow receives `verified: yes` plus a successful replay on the accepted sources
- **THEN** the Reticle traceability check reports the exact scenario and outcome denominators for that accepted source snapshot, proof-aware outcome counts, mixed-outcome and total-proof counts, and the exact passing flow denominator

### Requirement: Reticle evidence remains advisory to deterministic acceptance

The Reticle traceability capability MUST complement existing deterministic tests and reviewed product evidence and MUST NOT replace their acceptance verdicts.

Consumer surfaces: `behavioral-ui-regression-gate`, the Reticle coverage gate, and repository acceptance reporting.

#### Scenario: Reticle reports behavior that conflicts with a deterministic contract

- **WHEN** a Reticle result and deterministic acceptance evidence disagree
- **THEN** the disagreement is reported and investigated rather than silently overwriting the deterministic verdict
