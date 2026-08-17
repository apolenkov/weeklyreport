# ai-prompt-management Specification

## Purpose

Define the code-registered, feature-scoped prompt control plane and its
fail-closed runtime contract.

## Requirements

### Requirement: Registered features own prompt composition

Every administrator-visible AI feature MUST be registered in the typed
`AiFeaturePromptCatalog`. A catalog entry MUST own its stable feature key,
required slots, complete-prompt schema, contract versions, composer, and evaluator
metadata. API input MUST reject unregistered feature keys, unknown slots,
lifecycle fields, hashes, and catalog-owned versions.

#### Scenario: Report Assistant baseline is composed deterministically

- **WHEN** the `lead-report-assistant` entry composes its four required slots
- **THEN** each effective slot equals the complete administrator-managed prompt
  text stored in the immutable revision
- **AND** the content hash is deterministic for the same feature and prompt text

#### Scenario: An administrator attempts to change catalog ownership

- **WHEN** a draft input includes an unknown slot or catalog-owned field
- **THEN** strict shared validation rejects the input before persistence

### Requirement: Prompt revisions are immutable and feature-local

The persistence layer MUST store immutable `AiPromptBundleRevision` rows,
one `AiFeaturePromptControl` row per registered feature, and durable
`AiPromptEvaluation` rows. Revision numbers MUST be monotonic within a feature,
allocated under a feature-local concurrency guard, and linked to the selected
base revision. Only `draft` and `failed` revisions MAY be discarded. Active,
validated, and superseded revisions MUST remain available for exact history and
restore operations.

#### Scenario: Concurrent drafts receive distinct revisions

- **WHEN** two administrators create drafts from the same feature at the same
  time
- **THEN** both writes complete with distinct feature-local revision numbers
- **AND** neither write changes the feature's active pointer

#### Scenario: A disposable attempt is discarded

- **WHEN** an administrator discards a draft or failed revision
- **THEN** the repository conditionally deletes that revision only while it is
  disposable
- **AND** active, validated, and superseded revisions remain untouched

### Requirement: Activation requires an exact provider evaluation

Prompt evaluation MUST use synthetic data and persist only bounded check codes,
counts, outcome, timestamps, and the exact identity tuple of prompt revision,
provider revision, content hash, core contract version, and evaluator version.
Activation and restore MUST recheck that exact passing evaluation and the
currently enabled active provider inside the pointer-swap transaction. A stale
or failed pair MUST leave the existing prompt pointer, provider pointer, and
embedding state unchanged.

#### Scenario: A candidate is activated after a passing evaluation

- **WHEN** the candidate lifecycle and evaluation identity are current
- **THEN** the feature pointer swaps atomically and the previous active bundle
  becomes superseded

#### Scenario: The provider changes after evaluation

- **WHEN** the evaluated provider revision is no longer the enabled active
  provider at activation time
- **THEN** activation fails with a controlled conflict/configuration error
- **AND** no prompt or provider pointer changes

### Requirement: Runtime resolves one durable provider/prompt snapshot

The report-assistant runtime MUST read the enabled active provider and the active
compatible `lead-report-assistant` prompt bundle under one repeatable-read
database snapshot. The runtime snapshot MUST carry feature identity, prompt
revision identity, contract version, and all composed prompt slots. Missing,
corrupt, unevaluated, or incompatible prompt state MUST return the existing
`ai_not_configured` outcome before retrieval. Compiled prompt text MUST NOT be a
runtime fallback; exact provider-only resolution for embedding workers MUST stay
independent of prompt activation.

#### Scenario: A request crosses an activation boundary

- **WHEN** a prompt activation occurs after request snapshot resolution
- **THEN** planner, planner repair, answer, and citation repair use the same
  immutable composed prompt set for that request

#### Scenario: The active prompt is absent or corrupt

- **WHEN** the provider is active but the prompt control, snapshot, or exact
  evaluation is missing or invalid
- **THEN** the assistant returns `ai_not_configured` without retrieval or
  provider work

### Requirement: Prompt administration is safe and observable

The `admin.aiPrompts` read, draft, evaluate, activate, restore, and discard
procedures MUST use the canonical admin middleware chain. Read models MAY expose
complete prompt text, lifecycle, history, and bounded evaluation status,
but MUST NOT expose credentials, provider bodies, report data, questions,
generated answers, or prompt bodies through logs, metrics, or audit payloads.
Lifecycle metrics MUST use bounded feature/operation/outcome labels and MUST NOT
use revision IDs or hashes as labels.

#### Scenario: A non-admin invokes prompt management

- **WHEN** a lead, head, viewer, or unauthenticated caller invokes an
  `admin.aiPrompts` procedure
- **THEN** canonical role middleware rejects the request before prompt or
  provider data is read

#### Scenario: A safe lifecycle transition is audited

- **WHEN** an administrator drafts, evaluates, activates, restores, discards,
  or bootstraps a prompt revision
- **THEN** the audit event contains only safe actor/feature/revision/transition
  metadata and the bounded metric contains no prompt or provider payload
