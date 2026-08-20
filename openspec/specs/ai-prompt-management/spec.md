# ai-prompt-management Specification

## Purpose

Define the code-registered, feature-scoped prompt control plane and its
fail-closed runtime contract.

## Requirements

### Requirement: Registered features own prompt composition

Every administrator-visible AI feature MUST be registered in the typed
`AiFeaturePromptCatalog`. A catalog entry MUST own its stable feature key,
required slots, complete-prompt schema, contract versions, serving-contract
identity, composer metadata, and limits. API input MUST reject
unregistered feature keys, unknown slots, lifecycle fields, hashes, and
catalog-owned versions. Prompt wording MUST be supplied by the persisted
immutable revision; the catalog MUST NOT silently substitute compiled prompt
text during runtime resolution.

#### Scenario: Report Assistant baseline is composed deterministically

- **WHEN** the handoff operation composes the four current
  `lead-report-assistant` slots
- **THEN** each effective slot equals the exact prompt text currently used by
  the working code pipeline
- **AND** the canonical bundle hash, contract versions, composer version, and
  serving-contract identity are recorded in the baseline revision

#### Scenario: An administrator attempts to change catalog ownership

- **WHEN** a draft input includes an unknown slot or catalog-owned field
- **THEN** strict shared validation rejects the input before persistence

### Requirement: Prompt revisions are immutable and feature-local

The persistence layer MUST store immutable `AiPromptBundleRevision` rows and
one `AiFeaturePromptControl` row per registered feature. Revision numbers MUST
be monotonic within a feature,
allocated under a feature-local concurrency guard, and linked to the selected
base revision. Each serving-capable revision MUST carry the current
catalog-owned serving-contract identity. Revisions missing that identity or
created for a retired integration MUST remain inspectable history but MUST NOT
be activated, restored, or resolved for serving. Only `draft` and `failed`
revisions MAY be discarded. Active, validated, and superseded revisions MUST
remain available for exact history and restore operations.

#### Scenario: Concurrent drafts receive distinct revisions

- **WHEN** two administrators create drafts from the same feature at the same
  time
- **THEN** both writes complete with distinct feature-local revision numbers
- **AND** neither write changes the feature's active pointer
- **AND** both revisions inherit the current serving-contract identity

#### Scenario: A legacy revision is selected for activation

- **WHEN** an administrator submits a revision created without the current
  serving-contract identity
- **THEN** activation or restore fails with a controlled configuration or
  conflict error
- **AND** the existing active pointer remains unchanged

#### Scenario: A disposable attempt is discarded

- **WHEN** an administrator discards a draft or failed revision
- **THEN** the repository conditionally deletes that revision only while it is
  disposable
- **AND** active, validated, and superseded revisions remain untouched

### Requirement: Current prompt revisions activate without a provider test

Activation and restore MUST validate the current serving-contract identity, the
catalog-owned composition, the stored content hash, and the allowed lifecycle.
They MUST NOT call a provider, call an LLM, or require a provider-test result.
The pointer swap MUST be atomic, and a stale or invalid candidate MUST
leave the existing active prompt unchanged. A compare-and-set conflict MUST
roll back the candidate transition and return a controlled conflict.
Provider activation MUST remain independent from prompt lifecycle operations.

#### Scenario: A current candidate is activated directly

- **WHEN** a current-contract draft contains a valid composed prompt bundle
- **THEN** the feature pointer swaps atomically and the previous active bundle
  becomes superseded
- **AND** no provider or LLM request is made

#### Scenario: The provider is unavailable during prompt activation

- **WHEN** an administrator activates a structurally valid current prompt
  while no active provider is configured
- **THEN** prompt activation still succeeds
- **AND** provider state remains unchanged

#### Scenario: Another administrator activates a prompt first

- **WHEN** two administrators activate different current candidates concurrently
- **THEN** exactly one feature pointer compare-and-set succeeds
- **AND** the losing candidate transition is rolled back

#### Scenario: A legacy candidate is submitted

- **WHEN** a legacy candidate is submitted for activation or restore
- **THEN** the operation fails because its serving identity is not current
- **AND** the current active prompt revision remains serving

### Requirement: Runtime resolves one durable provider/prompt snapshot

The report-assistant runtime MUST read the enabled active provider and the
active current-serving `lead-report-assistant` prompt bundle under one
repeatable-read database snapshot. The runtime snapshot MUST carry feature
identity, prompt revision identity, serving-contract identity, contract
version, and all composed prompt slots. Missing, corrupt, legacy, or
incompatible prompt state MUST return the existing `ai_not_configured` outcome
before retrieval. A structurally valid current-serving prompt MUST remain
resolvable without a separate quality record. Compiled prompt text MUST NOT be a
runtime fallback; exact provider-only resolution for embedding workers MUST
stay independent of prompt activation.

#### Scenario: A request crosses an activation boundary

- **WHEN** a prompt activation occurs after request snapshot resolution
- **THEN** planner, planner repair, answer, and citation repair use the same
  immutable composed prompt set for that request

#### Scenario: The active prompt is absent or corrupt

- **WHEN** the provider is active but the prompt control, snapshot, serving
  identity, or content hash is missing or invalid
- **THEN** the assistant returns `ai_not_configured` without retrieval or
  provider work

#### Scenario: An active prompt has no separate quality record

- **WHEN** the active prompt is structurally valid and current-serving
- **THEN** runtime resolution still returns the provider/prompt snapshot
- **AND** no quality evaluation or LLM request is made as part of resolution

### Requirement: Prompt administration is safe and observable

The `admin.aiPrompts` read, draft, activate, restore, and discard procedures
MUST use the canonical admin middleware chain. Read models MAY expose complete
prompt text, lifecycle, history, and whether a revision is current-serving,
legacy, or incompatible, but MUST NOT expose credentials, provider bodies,
report data, questions, or generated answers through logs, metrics, or audit
payloads. Lifecycle metrics MUST use bounded feature/operation/outcome labels
and MUST NOT use revision IDs, hashes, or prompt text as labels. The settings UI
MUST describe direct activation of the current editor prompt and MUST NOT offer
an incompatible history row as an activation candidate.

#### Scenario: A non-admin invokes prompt management

- **WHEN** a lead, head, viewer, or unauthenticated caller invokes an
  `admin.aiPrompts` procedure
- **THEN** canonical role middleware rejects the request before prompt or
  provider data is read

#### Scenario: A safe lifecycle transition is audited

- **WHEN** an administrator drafts, activates, restores, discards, or bootstraps
  a prompt revision
- **THEN** the audit event contains only safe actor/feature/revision/transition
  metadata and the bounded metric contains no prompt or provider payload

#### Scenario: The editor displays legacy history

- **WHEN** an administrator opens a revision that lacks the current serving
  identity
- **THEN** the UI allows inspection and comparison
- **AND** it clearly marks the revision as legacy/incompatible and disables
  activation and restore
