## MODIFIED Requirements

### Requirement: Prompt evaluation proves the exact provider and content pair

`admin.aiPrompts.evaluate` MUST evaluate a candidate bundle against the exact active `generationCompatibilityIdentity` using only versioned synthetic fixtures. The evaluator MUST exercise protocol shape, representative English and Russian behavior, injection resistance, insufficient evidence, citations, and configured context limits. `AiPromptEvaluation` MUST identify the bundle revision, generation compatibility identity, content hash, evaluator version, safe check codes/counts, outcome, and timestamp, and MUST exclude prompts, provider response bodies, product data, credentials, embedding connection identity, and embeddings. A failed or inconclusive evaluation MUST leave the candidate inactive. Evaluation MUST use the existing durable asynchronous execution, deterministic sampling controls, provider-call concurrency limit, and transient-failure classification.

#### Scenario: Candidate passes the current generation suite

- **WHEN** every required synthetic check passes for the candidate content hash and active generation compatibility identity
- **THEN** the bundle becomes validated and remains eligible while that exact tuple is current

#### Scenario: Candidate produces valid syntax but wrong behavior

- **WHEN** structured output parses but an intent, grounding, injection, citation, language, or context-budget check fails
- **THEN** evaluation fails with safe check metadata and the active bundle remains unchanged

#### Scenario: Prompt evaluation is interrupted by a transient provider failure

- **WHEN** a prompt check encounters throttling, timeout, transport failure, or provider/server failure
- **THEN** the durable outcome is inconclusive and the candidate remains inactive

#### Scenario: Only the embedding connection changes

- **WHEN** the active composite revision changes but its generation compatibility identity remains exact
- **THEN** the existing prompt evaluation remains current
- **AND** no prompt evaluation request is sent to the embedding provider

### Requirement: Prompt activation and restoration are atomic and fail closed

`admin.aiPrompts.activate` MUST transactionally recheck candidate lifecycle, feature catalog, required slots, content hash, evaluator version, enabled active composite revision, its generation compatibility identity, and the exact passing evaluation before swapping the feature pointer. Prompt-only activation MUST NOT test embeddings or rebuild them. Restore MUST reactivate retained content only after a current passing generation evaluation and MUST NOT edit old content. Any failed recheck MUST preserve the old active bundle; direct or concurrent pointer manipulation MUST NOT produce mixed prompt slots or a prompt paired with an unevaluated generation identity.

#### Scenario: Validated prompt bundle activates

- **WHEN** activation rechecks the same passing generation/content/evaluator tuple
- **THEN** all Report Assistant slots become active through one pointer swap
- **AND** new requests use the bundle while in-flight requests retain their prior snapshot

#### Scenario: Embedding-only activation occurred after evaluation

- **WHEN** the active composite revision changed only in embedding identity and generation compatibility remains exact
- **THEN** prompt activation may proceed without reevaluation

#### Scenario: Generation evaluation becomes stale

- **WHEN** generation identity, content hash, catalog contract, or evaluator version differs from the passed result
- **THEN** activation fails without changing the active bundle

#### Scenario: Administrator restores a superseded bundle

- **WHEN** a retained bundle passes the current evaluator against the active generation identity and the administrator confirms restore
- **THEN** the system atomically makes that exact bundle active without rewriting content
