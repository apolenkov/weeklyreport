## ADDED Requirements

### Requirement: AI prompt management uses a code-registered feature catalog

The API MUST define an `AiFeaturePromptCatalog` whose entries own stable feature
keys, display metadata, required prompt slots, complete-prompt schemas,
deterministic composers, and synthetic evaluators.
The `admin.aiPrompts` tRPC surface MUST use the canonical `adminProcedure` for all
reads and mutations. Admin input MUST NOT create feature keys, add slots, or change
catalog-owned protocol metadata. The first registered feature MUST be
`lead-report-assistant` with planner, planner-repair, grounded-answer, and
citation-repair slots.

#### Scenario: Administrator reads a registered feature

- **WHEN** an administrator opens AI → Features → Report Assistant
- **THEN** `admin.aiPrompts` returns the catalog-defined slots and prompt-control
  state for `lead-report-assistant`
- **AND** no unregistered feature or slot is accepted from client input

#### Scenario: Non-administrator attempts prompt management

- **WHEN** a lead, head, viewer, or unauthenticated caller invokes any
  `admin.aiPrompts` procedure
- **THEN** canonical role middleware rejects the call before prompt data is read

### Requirement: Prompt revisions store complete administrator-managed text

Every prompt slot MUST store the complete administrator-managed text in an immutable
revision. Draft writes MUST accept complete text only for registered slots and a
valid registered feature/base revision. The server MUST reject attempts to submit
slot keys, feature metadata, version numbers, hashes, lifecycle state, unknown
fields, control characters, or content beyond configured per-slot and bundle limits.
Tools, schemas, authorization, retrieval, and runtime limits remain code-owned.

#### Scenario: Administrator saves behavioral changes

- **WHEN** an administrator submits valid complete text for every required Report
  Assistant slot
- **THEN** the server deterministically hashes the complete bundle
- **AND** client input cannot add slots or change code-owned runtime controls

#### Scenario: Administrator views the complete provider input

- **WHEN** an administrator reads a prompt-bundle revision
- **THEN** the response includes the complete saved prompt for each slot
- **AND** the response includes no provider credential or report data

### Requirement: Prompt bundles have immutable feature-scoped revisions

`AiPromptBundleRevision` MUST store one atomic bundle for one registered feature,
including a concurrency-safe monotonic feature-local revision number, optional base
revision, core-contract version and snapshot, editable instructions, effective
content hash, lifecycle, and safe timestamps. Saving an edit MUST create a new
`draft`; prompt content MUST NOT be updated in place. `AiFeaturePromptControl` MUST
hold at most one active bundle pointer per feature. Planner/repair and answer/repair
slots MUST activate and restore together.

#### Scenario: Administrator edits an active bundle

- **WHEN** an administrator saves changes based on the active Report Assistant
  revision
- **THEN** a new immutable draft revision is created with the active revision as
  its base
- **AND** the active pointer and currently serving prompt text remain unchanged

#### Scenario: Concurrent drafts receive distinct revisions

- **WHEN** two valid draft saves for the same feature race
- **THEN** each receives a distinct monotonic revision number
- **AND** neither write overwrites existing prompt content

### Requirement: Prompt evaluation proves the exact provider and content pair

`admin.aiPrompts.evaluate` MUST evaluate a candidate bundle against the exact
globally active provider revision using only versioned synthetic fixtures. The
feature evaluator MUST exercise protocol shape, representative English and Russian
behavior, injection resistance, insufficient evidence, citations, and configured
context limits applicable to that feature. `AiPromptEvaluation` MUST identify the
bundle revision, provider revision, content hash, evaluator version, safe check
codes/counts, outcome, and timestamp, and MUST exclude prompts, provider response
bodies, product data, and credentials. A failed evaluation MUST leave the candidate
inactive.

Prompt evaluation MUST use the same durable asynchronous execution, deterministic
sampling controls, provider-call concurrency limit, and transient-failure
classification as provider testing. Its initiating mutation MUST return after
durable acceptance, reads MUST expose pollable progress, and an inconclusive run
MUST leave the candidate inactive without claiming prompt incompatibility.

#### Scenario: Candidate passes the current evaluation suite

- **WHEN** every required synthetic check passes for the candidate content hash and
  active provider revision
- **THEN** the bundle becomes `validated` and is eligible for activation while that
  exact compatibility tuple remains current

#### Scenario: Candidate produces valid syntax but wrong behavior

- **WHEN** structured output parses but an intent, grounding, injection, citation,
  language, or context-budget check fails
- **THEN** the evaluation fails with safe check metadata
- **AND** the currently active bundle remains unchanged

#### Scenario: Prompt evaluation is interrupted by a transient provider failure

- **WHEN** a prompt check encounters throttling, timeout, transport failure, or a
  provider/server failure
- **THEN** the durable evaluation outcome is `inconclusive`
- **AND** the candidate remains inactive and may be evaluated again explicitly

### Requirement: Prompt activation and restoration are atomic and fail closed

`admin.aiPrompts.activate` MUST transactionally recheck the candidate lifecycle,
feature catalog, required slots, content hash, evaluator version, active provider
revision, and passing evaluation before swapping that feature's active pointer and
superseding the prior bundle. Prompt-only activation MUST NOT rebuild embeddings.
Restore MUST reactivate a retained bundle only after a current passing evaluation;
it MUST NOT edit old content. If any recheck fails, the old active bundle MUST keep
serving. Direct or concurrent pointer manipulation MUST NOT produce a mixed-slot
runtime bundle.

#### Scenario: Validated prompt bundle activates

- **WHEN** activation rechecks the same passing provider/content/evaluator tuple
- **THEN** all four Report Assistant slots become active through one pointer swap
- **AND** new requests use the bundle while in-flight requests retain their prior
  snapshot

#### Scenario: Evaluation becomes stale before activation

- **WHEN** provider identity, content hash, catalog contract, or evaluator version
  differs from the passed result
- **THEN** activation fails without changing the active bundle

#### Scenario: Administrator restores a superseded bundle

- **WHEN** a retained bundle passes the current evaluator against the active provider
  and the administrator confirms restore
- **THEN** the system atomically makes that exact bundle active
- **AND** no historical prompt content is rewritten

### Requirement: Administrators discard only unusable prompt attempts

`admin.aiPrompts.discard` MUST permanently remove only `draft` or `failed` prompt
revisions through a conditional lifecycle write. It MUST reject missing,
`validated`, `active`, and `superseded` revisions. Success MUST leave feature and
provider active pointers unchanged and emit safe audit metadata without prompt text.

#### Scenario: Administrator discards a failed prompt attempt

- **WHEN** an administrator confirms discard for a failed prompt revision
- **THEN** the revision is removed and no active runtime state changes

#### Scenario: Administrator attempts to discard a protected prompt revision

- **WHEN** discard targets a validated, active, or superseded bundle
- **THEN** the operation fails without deleting the revision

### Requirement: Current report-assistant prompts bootstrap once without runtime fallback

An explicit idempotent bootstrap MUST create the `lead-report-assistant` feature
control and first active bundle from the current v1 planner, planner-repair,
grounded-answer, and citation-repair contracts only when no prompt-control data
exists. Repeating bootstrap MUST not modify existing rows or pointers. After
bootstrap, runtime resolution MUST use durable prompt state only and MUST NOT fall
back to compiled prompt constants. Missing, corrupt, or incompatible active prompt
state MUST make that feature unavailable without affecting non-AI report workflows.

#### Scenario: Existing installation receives baseline prompts

- **WHEN** prompt bootstrap runs with no prompt control or revisions
- **THEN** it creates one active Report Assistant v1 bundle equivalent to the
  current effective prompts
- **AND** records a safe bootstrap audit event

#### Scenario: Prompt bootstrap repeats

- **WHEN** any Report Assistant prompt-control data already exists
- **THEN** bootstrap leaves all revisions and the active pointer unchanged

#### Scenario: Prompt state is unavailable

- **WHEN** the provider is active but no valid active Report Assistant bundle can be
  resolved
- **THEN** Report Assistant availability is `not_configured`
- **AND** no retrieval or provider request runs and report workflows remain available

### Requirement: Prompt lifecycle data is auditable without content leakage

Prompt draft creation, evaluation, activation, restore, discard, and bootstrap MUST
emit safe audit events containing actor when applicable, feature key, prompt and
provider revision IDs, content hash, contract/evaluator versions, transition, and
timestamp. Prompt text, questions, evidence, outputs, credentials, provider response
bodies, user/report/entity IDs, and embeddings MUST NOT appear in audit events,
logs, traces, jobs, client errors, or metric labels. Metrics MUST use bounded
feature/check/outcome labels and MUST NOT use revision IDs or hashes as labels.

#### Scenario: Administrator activates a prompt revision

- **WHEN** prompt activation succeeds or fails
- **THEN** the audit trail identifies the safe compatibility tuple and transition
- **AND** no prompt body or product/provider payload is recorded

#### Scenario: Prompt metrics are emitted

- **WHEN** evaluation or activation records operational metrics
- **THEN** labels are limited to bounded feature, check, and outcome values
- **AND** prompt/provider revision IDs and content hashes are absent from labels
