## MODIFIED Requirements

### Requirement: Draft configurations prove required capabilities before activation

The `admin.aiProvider.test` operation MUST use synthetic, non-report data to verify authentication, timeout handling, a strict structured search plan, strict structured answer output, token usage, batch embeddings, finite ordered vectors, and one consistent positive embedding-vector length. The structured planner MUST first attempt exactly one forced function call with parallel calls disabled and, after bounded invalid-tool retries, MAY negotiate the identical search-plan schema through strict JSON Schema output. The JSON Schema request MUST instruct the model to return the tool arguments object directly rather than require a tool-call envelope that is unavailable in that protocol. It MUST persist the measured embedding length only when every required provider capability passes, and MUST NOT send an embedding-dimensions option to the provider. Recoverable structured-output generation and transient provider responses MUST receive bounded retries, while authentication MUST be reported only for HTTP 401 or 403. The persisted provider lanes, feature compatibility, top-level result, durable execution, and non-active revision lifecycle MUST derive from one three-state aggregate: `passed`, `failed`, or `inconclusive`. A draft MUST NOT enter a validated or preparing state unless every required provider capability and active-feature compatibility check passes. Safe provider and feature status MUST be visible to the admin without provider response bodies. Retesting an active revision MUST persist the safe result and measurement without changing its `active` lifecycle, active pointer, or availability.

#### Scenario: All capabilities and active features pass

- **WHEN** the provider satisfies every planner, answer, usage, embedding, and active-feature probe within the configured bounded retries
- **THEN** the draft becomes validated and eligible for activation
- **AND** its top-level result and durable execution both report passed

#### Scenario: One capability fails

- **WHEN** authentication fails, a required parameter is unsupported after bounded retries, output violates its schema, vectors are invalid, or vectors in the batch have different lengths
- **THEN** the draft remains inactive with a safe field-level or capability-level failure attributed to the operation that failed
- **AND** the current active configuration is unchanged

#### Scenario: A provider response is transiently unavailable

- **WHEN** bounded retries are exhausted on a timeout, HTTP 429, or HTTP 5xx response
- **THEN** the provider result, execution, and visible feedback report inconclusive rather than failed or authenticated incorrectly
- **AND** the revision is not eligible for activation

#### Scenario: Provider lanes pass but feature compatibility is inconclusive

- **WHEN** Generation and Embeddings pass and an active-feature evaluator receives only inconclusive evidence
- **THEN** both provider lanes remain passed while the top-level result and durable execution are inconclusive
- **AND** the non-active revision does not become validated or failed

#### Scenario: Admin saves a draft without a vector-size setting

- **WHEN** an admin saves a provider profile, credential, and model identifiers
- **THEN** the system creates a draft without embedding dimensions
- **AND** it derives and persists the dimensions from a successful synthetic embedding response before activation

#### Scenario: Admin saves a successor to an inactive draft

- **WHEN** an administrator saves from an explicitly identified retained revision without changing either connection and leaves its credential fields blank
- **THEN** the server re-encrypts the retained generation and embedding credentials for the new revision
- **AND** the administrator does not need to paste either secret again
- **AND** a missing base revision or changed profile or endpoint still requires a new credential

#### Scenario: A new draft has the same compatibility fingerprint as an older failed revision

- **WHEN** an administrator tests a newly saved revision whose provider, models, credential fingerprint, and prompts match an older terminal execution
- **THEN** the system creates or reuses an execution scoped only to the new revision
- **AND** it queues and runs the provider test instead of returning the older revision's result
- **AND** the new revision's visible feedback observes only its own execution

#### Scenario: Administrator retries an incompatible revision

- **WHEN** the selected revision's latest provider execution completed as incompatible
- **AND** the administrator invokes Test capabilities again
- **THEN** the system creates a new revision-scoped retry execution and runs it
- **AND** the UI does not claim that a test was queued while continuing to reuse the old terminal failure

#### Scenario: Activation consumes revision-scoped execution evidence

- **WHEN** a validated or preparing revision has a completed passing provider execution whose identity is scoped to that revision
- **THEN** activation recognizes the execution as current evidence
- **AND** atomically activates the candidate instead of reporting a lifecycle race

#### Scenario: Activation is interrupted after preparation finishes

- **WHEN** a preparing revision has a positive total, every item completed, zero failures, and a finished timestamp but is not yet active
- **THEN** the administrator can resume activation without repeating semantic preparation
- **AND** the UI prioritizes that revision and prevents a competing draft save or test until activation is resolved

#### Scenario: Shared prompt evidence changes after a revision passed

- **WHEN** a candidate revision retains exact passing feature compatibility in its persisted test result
- **AND** a later nondeterministic retry records a non-passing shared evaluation for the same tuple
- **THEN** activation continues to recognize the candidate revision's immutable passing snapshot
- **AND** the later retry does not revoke its activation eligibility

#### Scenario: Test runs against synthetic content

- **WHEN** the server tests any provider profile
- **THEN** no report question, report record, user identifier, entity name, or existing embedding is sent

#### Scenario: Admin retests the active provider

- **WHEN** an administrator invokes `admin.aiProvider.test` for the revision selected by `AiProviderControl.activeConfigurationId`
- **THEN** the system persists the latest safe capability result and measured dimensions
- **AND** the revision remains `active`, the global pointer remains unchanged, and `ai.availability` remains `available`

## ADDED Requirements

### Requirement: Capability failures retain safe actionable identity

The provider capability result and `AiCompatibilityExecution` checks MUST retain the bounded provider failure code and the capability that actually failed. The system MUST NOT label a tool-call, schema, rate-limit, timeout, or server failure as authentication unless the provider returned HTTP 401 or 403.

#### Scenario: Groq rejects malformed generated tool arguments

- **WHEN** a tool-capable model returns `tool_use_failed` after bounded retry
- **THEN** Generation reports a failed Planner tool call with failure code `tool_use_failed`
- **AND** it does not report an authentication failure

#### Scenario: Tool generation remains invalid but strict planner JSON is supported

- **WHEN** bounded forced-tool attempts end with `tool_use_failed`
- **AND** the same model returns a valid search plan through strict JSON Schema output
- **THEN** Generation reports Structured planner passed
- **AND** the draft continues through the remaining capability and feature checks

#### Scenario: Planner falls back to strict JSON Schema output

- **WHEN** the planner retries through JSON Schema without exposing a tool definition
- **THEN** its system instruction requests the `search_report_entries` arguments as the top-level JSON object
- **AND** the response is validated by the same search-plan schema used for native tool arguments

#### Scenario: Provider rejects a credential

- **WHEN** the provider returns HTTP 401 or 403
- **THEN** the affected lane reports Authentication failed with the bounded authentication failure code
