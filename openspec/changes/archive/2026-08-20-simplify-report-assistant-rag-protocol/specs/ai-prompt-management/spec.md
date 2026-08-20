## MODIFIED Requirements

### Requirement: Prompt revisions are immutable, feature-local, and not runtime-serving

The persistence layer MUST continue to store immutable `AiPromptBundleRevision` rows, one `AiFeaturePromptControl` row per registered feature, and durable `AiPromptEvaluation` rows for future editor work and diagnostics. Revision operations MUST NOT change the code-owned prompts used by report-assistant runtime in this change. The administration surface MUST state that stored prompt revisions do not currently control runtime.

#### Scenario: Administrator saves or activates a prompt revision

- **WHEN** an administrator changes stored prompt lifecycle state
- **THEN** the revision history is updated according to its existing safety rules
- **AND** in-flight and subsequent report-assistant requests continue using code-owned prompts

### Requirement: Prompt evaluation is diagnostic

Prompt evaluation MUST use synthetic data and persist only bounded check codes, counts, outcome, timestamps, and evaluation identity. Its result MUST NOT gate provider activation, runtime availability, or the code-owned prompt snapshot.

#### Scenario: Prompt evaluation fails

- **WHEN** a stored prompt revision receives a failed or inconclusive evaluation
- **THEN** administrators can inspect the diagnostic outcome
- **AND** the active provider and report-assistant availability remain unchanged

### Requirement: Runtime resolves a code-owned prompt snapshot

The report-assistant runtime MUST compose its complete planner, planner-retry, answer, and citation-repair instructions from versioned source constants. It MUST NOT read `AiFeaturePromptControl`, `AiPromptBundleRevision`, or `AiPromptEvaluation` to determine serving availability. Exact provider-only resolution for embedding workers MUST remain independent.

#### Scenario: Stored prompt state is missing or incompatible

- **WHEN** the active provider is enabled but stored prompt control, revisions, or evaluations are absent, stale, failed, or incompatible
- **THEN** the assistant resolves its code-owned prompt snapshot and remains available

#### Scenario: Code-owned prompt version is used consistently

- **WHEN** one report-assistant request performs planner, retry, answer, or citation repair calls
- **THEN** all calls use the same code-owned prompt version
