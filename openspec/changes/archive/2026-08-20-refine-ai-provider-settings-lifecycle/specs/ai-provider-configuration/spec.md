## MODIFIED Requirements

### Requirement: Only administrators manage the global AI integration

The `admin.aiProvider` tRPC surface and Settings → AI → Provider controls MUST use
the canonical `adminProcedure` for every configuration read, draft write, test,
activation, disable, rollback, progress, and discard operation. The system MUST
maintain one organization-wide active provider configuration and MUST NOT expose
per-user, per-role, or per-feature provider overrides. Provider management MUST NOT
remain duplicated under Settings → Integrations.

#### Scenario: Administrator manages the provider

- **WHEN** an authenticated administrator opens AI → Provider or submits a valid
  provider operation
- **THEN** the system permits the operation through `adminProcedure`

#### Scenario: Non-administrator attempts provider access

- **WHEN** a lead, head, viewer, or unauthenticated caller invokes an AI provider
  configuration procedure
- **THEN** canonical role middleware rejects the call before configuration or
  credential data is read

#### Scenario: Authorized users invoke an AI feature

- **WHEN** an AI feature passes its own role, availability, and data-authorization
  gates
- **THEN** it uses the same globally active provider revision regardless of caller
- **AND** provider configuration grants no additional role access

## ADDED Requirements

### Requirement: Administrators discard only unusable provider attempts

The `admin.aiProvider.discard` tRPC procedure and
`AiProviderConfigurationRepository` write path MUST use the canonical
`adminProcedure` and MUST permanently remove a configuration revision only when its
lifecycle is `draft` or `failed`. The operation MUST reject a missing revision and
MUST reject `validated`, `preparing`, `active`, and `superseded` revisions. The
repository MUST make lifecycle eligibility part of the deletion write so a
concurrent transition cannot delete a protected revision. Success MUST remove its
encrypted credential material and emit a safe audit event with actor, revision,
profile/model metadata, transition, and timestamp but no credential or provider
payload.

#### Scenario: Administrator discards a failed provider attempt

- **WHEN** an administrator confirms discard for a failed revision
- **THEN** the system removes that revision and its encrypted credential material
- **AND** active configuration, availability, and retained revisions are unchanged

#### Scenario: Protected provider lifecycle is rejected

- **WHEN** discard targets a `validated`, `preparing`, `active`, or `superseded`
  revision
- **THEN** the operation fails without deleting the revision or changing the active
  pointer

#### Scenario: Provider lifecycle changes during discard

- **WHEN** another operation advances a disposable revision before the conditional
  delete commits
- **THEN** discard reports a controlled failure
- **AND** the protected revision remains stored

#### Scenario: Non-administrator attempts provider discard

- **WHEN** a non-administrator invokes `admin.aiProvider.discard`
- **THEN** canonical role middleware rejects the call before revision data is read

### Requirement: Provider activation proves compatibility with active feature prompts

Provider testing MUST run generic protocol and embedding capability probes and MUST
also evaluate every active registered AI-feature prompt bundle against the exact
candidate provider revision using synthetic non-product data. The safe result MUST
identify bounded feature/check outcomes without prompt text or provider response
bodies. Provider activation MUST transactionally recheck that all required generic
and feature evaluations still match the candidate provider, active prompt revision
IDs, content hashes, and current evaluator versions. Any stale or failing result
MUST keep the existing provider active.

Starting provider testing MUST be a short durable-acceptance operation. It MUST
conditionally create or reuse an execution in `queued` state, enqueue exactly one
background job for the immutable provider/prompt/evaluator identity, and return
without waiting for provider calls. The execution MUST transition only through
`queued` → `running` → `completed`; a completed execution MUST have exactly one
outcome from `passed`, `incompatible`, `configuration_error`, or `inconclusive`.
Execution state MUST remain separate from provider lifecycle. A pass MAY advance the
candidate to `validated`; incompatibility or configuration error MAY move it to
`failed`; an inconclusive run MUST preserve its pre-test eligible lifecycle.
Provider reads MUST expose the bounded execution so clients can poll and resume
after reload. A second start for the same in-flight identity MUST NOT duplicate
provider requests.

Provider-calling generation checks MUST run at a code-owned maximum concurrency of
one. Capability evaluation and runtime generation MUST both omit sampling overrides,
including `temperature`; that request policy MUST be included in evaluator identity
and MUST NOT be administrator configurable. Each generic and feature check MUST
produce `passed`, `incompatible`,
or `inconclusive` plus a bounded safe code. Authentication or authorization failure
MUST fail the configuration. Throttling, timeout, transport, and provider/server
failure MUST make the execution inconclusive and MUST NOT be stored or displayed as
model, prompt, reasoning, or answer-protocol incompatibility.

Every provider revision MUST store one generation reasoning configuration from
`provider_default`, `off`, or `custom`. A `custom` configuration MUST additionally
store one trimmed, non-empty provider-specific text value of at most 64 characters;
the other configurations MUST NOT store a custom value. Provider revisions MUST NOT
accept raw reasoning JSON, arbitrary request parameters, or provider-routing
controls.

The selected profile MUST translate the configuration as follows:

- `provider_default` MUST omit reasoning for every profile;
- `openrouter` MUST send `off` as `reasoning.effort = "none"` and `custom` as
  `reasoning.effort = <custom value>`;
- `mistral` and `custom-openai-compatible` MUST send `off` as
  `reasoning_effort = "none"` and `custom` as
  `reasoning_effort = <custom value>`.

The profile-specific translation MUST occur before the generic transport boundary.
Capability testing MUST exercise the exact field shape and value against both
planner and answer contracts. Provider rejection MUST produce a bounded safe
failure and MUST NOT cause a different value or field shape to be tried implicitly.

Provider testing MUST select exactly one answer protocol between `json_schema` and
`forced_tool`. It MUST probe strict JSON Schema output first and MAY probe the
forced, side-effect-free answer tool only after a classified protocol-shape
incompatibility. It MUST NOT negotiate after authentication, authorization,
throttling, timeout, transport, or provider/server failure. The selected protocol
MUST be stored with the tested revision, included in compatibility identity, and
used by feature evaluation and runtime without protocol fallback. Both protocols
MUST validate through the same server-owned answer schema.

#### Scenario: Candidate provider supports all active features

- **WHEN** generic capability probes and every active feature prompt evaluator pass
  against a candidate provider revision
- **THEN** that revision may become validated and proceed through the existing
  embedding preparation and activation flow

#### Scenario: Provider test is accepted asynchronously

- **WHEN** an administrator starts testing an eligible provider revision
- **THEN** the mutation durably records or reuses one `queued` execution and returns
  before any complete provider suite is required
- **AND** Settings reads expose progress until a terminal result is persisted

#### Scenario: Duplicate provider test start is idempotent

- **WHEN** the same compatibility identity is already `queued` or `running`
- **THEN** another start returns that execution instead of sending duplicate probes

#### Scenario: Provider test survives page reload

- **WHEN** the administrator reloads or leaves Settings while testing is running
- **THEN** the worker continues independently of the original HTTP request
- **AND** reopening Provider displays the durable current status and result

#### Scenario: Transient feature probe is inconclusive

- **WHEN** any synthetic check encounters throttling, timeout, transport failure, or
  provider/server failure
- **THEN** the execution records an `inconclusive` bounded outcome
- **AND** it does not claim that the model, prompts, reasoning value, or answer
  protocol are incompatible
- **AND** activation remains unavailable until a later complete run passes

#### Scenario: Provider probes do not create a burst

- **WHEN** the suite contains multiple generation checks
- **THEN** at most one provider generation request is in flight for that execution
- **AND** every request uses the evaluator-versioned sampling policy

#### Scenario: Provider default reasoning is selected

- **WHEN** an administrator tests a revision with `provider_default` reasoning
- **THEN** planner and answer probes omit the reasoning parameter
- **AND** the provider's own default behavior must still complete both contracts

#### Scenario: Custom reasoning value is supported

- **WHEN** planner and answer probes both complete using the selected profile's wire
  shape and exact custom reasoning value
- **THEN** that exact configuration is retained as part of the revision's tested
  runtime configuration

#### Scenario: Off reasoning is translated by profile

- **WHEN** an administrator tests a revision with `off` reasoning
- **THEN** the selected profile sends its specified reasoning field with `none`
- **AND** both planner and answer contracts must pass with that exact configuration

#### Scenario: Reasoning configuration is incompatible

- **WHEN** either selected model rejects or cannot complete its contract with the
  chosen reasoning field and value
- **THEN** the capability result contains a bounded safe failure code
- **AND** the revision remains ineligible for activation

#### Scenario: Strict JSON Schema answer protocol passes

- **WHEN** the answer model accepts strict JSON Schema response format and returns a
  payload that passes the server-owned answer schema
- **THEN** `json_schema` is persisted as the tested answer protocol

#### Scenario: Forced answer tool is selected after protocol incompatibility

- **WHEN** strict JSON Schema response format has a classified protocol-shape
  incompatibility and one forced answer-tool call returns schema-valid arguments
- **THEN** `forced_tool` is persisted as the tested answer protocol
- **AND** the tool call performs no external side effect

#### Scenario: Transient failure does not select another protocol

- **WHEN** the JSON Schema probe encounters authentication failure, throttling,
  timeout, transport failure, or provider/server failure
- **THEN** capability testing fails with a bounded safe code
- **AND** it does not run forced-tool negotiation

#### Scenario: Neither answer protocol passes

- **WHEN** neither JSON Schema output nor the forced answer tool produces one
  schema-valid structured answer
- **THEN** no answer protocol is selected and the revision cannot activate

#### Scenario: Active feature prompt fails on the candidate provider

- **WHEN** any registered active feature prompt bundle fails its synthetic suite
  against the candidate provider
- **THEN** the provider revision is not eligible for activation
- **AND** the current provider continues serving users

#### Scenario: Active prompt changes after provider testing

- **WHEN** a feature's active prompt pointer or content hash no longer matches the
  provider compatibility result at activation time
- **THEN** provider activation fails closed and requires a new test

#### Scenario: Tested generation configuration changes

- **WHEN** the revision's reasoning configuration, selected answer protocol, or applicable
  compatibility version differs from the passing test identity
- **THEN** provider activation fails closed and requires a new test

#### Scenario: Provider compatibility testing uses no product data

- **WHEN** provider compatibility is tested for registered features
- **THEN** no report question, report record, user identifier, entity name,
  generated answer, credential, or existing embedding is included in feature
  evaluation fixtures or persisted results
