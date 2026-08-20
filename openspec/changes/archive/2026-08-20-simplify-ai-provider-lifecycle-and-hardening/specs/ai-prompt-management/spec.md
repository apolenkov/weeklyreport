## REMOVED Requirements

### Requirement: Prompt revisions require provider compatibility evaluation

**Reason**: Feature-level provider compatibility evaluation is legacy and is
no longer part of prompt lifecycle or provider activation.

**Migration**: Remove synthetic prompt evaluators, prompt evaluation records,
compatibility execution branches, provider compatibility service methods, and
their result fields. Prompt lifecycle uses structural/current-contract checks.

## MODIFIED Requirements

### Requirement: Current prompt revisions activate without provider evaluation

Activation and restore MUST validate the current serving-contract identity, the
catalog-owned composition, the stored content hash, and the allowed lifecycle.
They MUST NOT call a provider, call an LLM, look up a prompt evaluation, or
require a quality/evaluation result. The pointer swap MUST be atomic, and a
stale or invalid candidate MUST leave the existing active prompt unchanged. A
compare-and-set failure MUST be reported as a conflict and MUST roll back the
candidate and previous-revision lifecycle writes. Provider activation MUST
remain independent from prompt lifecycle operations.

#### Scenario: A concurrent prompt activation loses the pointer race

- **WHEN** two administrators activate different current-contract revisions
  concurrently and one pointer compare-and-set loses
- **THEN** the losing operation returns a controlled conflict
- **AND** its candidate and superseded lifecycle changes are rolled back
- **AND** the prior active pointer remains valid

### Requirement: Prompt execution has no provider compatibility job

The `admin.aiPrompts` surface MUST expose draft, activate, restore, discard,
and read operations only. It MUST NOT enqueue or persist a provider
compatibility/evaluation job for a prompt revision. Prompt reads MUST expose
structural lifecycle and serving status without `latestEvaluation` or
`latestExecution` compatibility fields.

#### Scenario: Administrator activates a valid prompt

- **WHEN** an administrator activates a current-contract prompt revision
- **THEN** the pointer swaps atomically without a provider or worker call
- **AND** the response contains no compatibility execution state
