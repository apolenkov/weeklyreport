## MODIFIED Requirements

### Requirement: The Lead report surface exposes a native Chat entry point

The Lead report context toolbar MUST render **Chat** immediately beside the existing
**Agent review** placeholder. Chat MUST be active only when the global provider is
available and an active compatible `lead-report-assistant` prompt bundle is
available. When either dependency is not configured, unresolved, or cannot be read,
Chat MUST remain visible but disabled and MUST explain in English that AI is not
configured by an administrator. The control and chat surface MUST reuse existing
report-toolbar, dialog/sheet/layout, typography, spacing, color, focus, busy, empty,
and error patterns. Head, admin, viewer, print, and unrelated report surfaces MUST
NOT gain an active assistant control.

#### Scenario: Lead opens configured Chat

- **WHEN** a Lead activates Chat while provider and Report Assistant prompt
  availability are both confirmed
- **THEN** the assistant surface opens without losing report context
- **AND** toolbar controls retain their established height and alignment

#### Scenario: Report Assistant prompt bundle is unavailable

- **WHEN** the provider is active but no valid active Report Assistant prompt bundle
  can be resolved
- **THEN** Chat remains visible but disabled with explanatory copy
- **AND** the web client sends no assistant request

#### Scenario: Availability has not been confirmed

- **WHEN** feature availability is loading or returns an error
- **THEN** Chat remains visible but disabled and sends no assistant request

#### Scenario: Non-Lead invokes the assistant procedure

- **WHEN** a head, admin, viewer, or unauthenticated caller invokes the procedure
- **THEN** canonical role middleware rejects the request before prompt resolution or
  assistant retrieval runs

## ADDED Requirements

### Requirement: Report Assistant uses one provider-plus-prompt snapshot per request

At the start of each authorized request, `AiRuntimeResolver` MUST resolve the enabled
active provider revision and active `lead-report-assistant` prompt-bundle revision
under one consistent database snapshot. The resulting runtime snapshot MUST contain
the feature key, provider revision identity, prompt revision identity,
core-contract version, and all four composed effective prompts. Planner,
planner-repair, grounded-answer, and citation-repair calls for that request MUST use
that same immutable snapshot, including its tested reasoning configuration and answer
protocol, even if an administrator activates another provider or prompt bundle
concurrently. Exact-revision embedding workers MUST remain independent of feature
prompt state.

#### Scenario: Prompt activation occurs during a request

- **WHEN** an administrator activates a new Report Assistant bundle after a Lead
  request acquires its runtime snapshot
- **THEN** every planner and answer attempt in that request uses the prior bundle
- **AND** the next request may use the newly active bundle

#### Scenario: Provider and prompt pair cannot be resolved consistently

- **WHEN** no enabled compatible provider-plus-prompt pair exists at request start
- **THEN** the procedure returns `{ "kind": "ai_not_configured" }` before retrieval
  or provider work
- **AND** it does not fall back to compiled prompt constants

### Requirement: Report Assistant prompt composition preserves code-owned enforcement

The report-assistant adapters MUST receive composed prompts from the runtime snapshot
rather than importing active system text from application constants. Administrator
instructions MUST NOT change the forced `search_report_entries` tool, generated
SearchPlan JSON Schema, disabled parallel calls, message/data separation, strict
answer schema, tested answer protocol, server-owned authorization/retrieval,
citation validation, repair bounds, or context limits. Report evidence MUST remain
serialized untrusted data and MUST never be interpolated into locked or editable
system instructions.

The planner and answer adapters MUST apply the snapshot's tested reasoning
configuration to every initial and repair call, including the exact custom value
when configured. The answer adapter MUST use only the snapshot's
persisted `json_schema` or `forced_tool` protocol and MUST validate either response
through the same strict answer schema. It MUST NOT retry the other protocol during a
Lead request.

#### Scenario: Administrator instructions request a protocol override

- **WHEN** editable instructions conflict with a locked core or structural runtime
  control
- **THEN** evaluation fails or the code-owned control remains authoritative
- **AND** activation cannot broaden authorization or expose additional tools

#### Scenario: Report evidence contains prompt text

- **WHEN** an authorized report record contains instructions or policy-like text
- **THEN** it remains only in the serialized grounding data message
- **AND** neither locked nor editable system prompt content is derived from it

#### Scenario: Runtime uses the tested JSON Schema protocol

- **WHEN** the active provider revision stores `json_schema`
- **THEN** grounded-answer and citation-repair calls request strict JSON Schema
  output and validate it through the server-owned answer schema
- **AND** no answer tool is sent

#### Scenario: Runtime uses the tested forced-tool protocol

- **WHEN** the active provider revision stores `forced_tool`
- **THEN** grounded-answer and citation-repair calls force exactly one code-owned
  answer tool and parse only its schema-valid arguments
- **AND** the tool call causes no external side effect

#### Scenario: Active answer protocol fails at runtime

- **WHEN** the provider fails to satisfy the persisted tested answer protocol during
  a Lead request
- **THEN** the assistant returns its existing safe provider-unavailable outcome
- **AND** it does not retry through the other answer protocol
