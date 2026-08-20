## Why

An administrator can see Generation and Embeddings pass while the same provider revision is marked failed with a generic provider error. A live Groq/Jina check confirmed valid credentials and models, but Groq's recoverable `tool_use_failed` and rate-limit responses are misclassified, feature probes burst concurrently, and hidden prompt compatibility can contradict the visible provider result.

## What Changes

- Preserve a truthful three-state result (`passed`, `failed`, or `inconclusive`) across provider capabilities, feature compatibility, durable executions, and revision lifecycle.
- Show provider lanes and feature compatibility separately, including bounded failure codes and retry guidance.
- Classify authentication only for HTTP 401/403; attribute tool-call and transient failures to the operation that actually failed.
- Retry Groq-style invalid tool-call generation with deterministic request settings and bounded backoff for retryable provider responses.
- Fall back from exhausted native tool generation to the same strict planner schema through OpenAI-compatible JSON Schema output, with protocol-consistent instructions that request the arguments object directly.
- Run feature compatibility probes with bounded concurrency so one test does not create an avoidable request burst.
- Scope durable provider-test execution identities to a specific saved revision so a new draft cannot inherit an older revision's terminal result.
- Let an administrator save a successor draft from the currently observed inactive revision without re-entering unchanged credentials.
- Carry revision-scoped execution evidence through activation and make a completed/interrupted preparation resumable instead of leaving the provider stranded in `preparing`.
- Make exact provider/prompt passing evidence monotonic and activate from the candidate revision's immutable passing snapshot, so a later nondeterministic probe cannot revoke an earlier pass.
- Add regression coverage for the observed Groq/Jina outcomes and contradictory stored state.

### Non-goals

- Weakening provider capability or active-feature compatibility gates.
- Treating an inconclusive evaluation as a passing evaluation eligible for activation.
- Exposing provider response bodies, credentials, prompts, or report data.
- Adding a provider-specific bypass for Groq or Jina; planner protocol negotiation remains provider-neutral.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-provider-configuration`: capability tests retain truthful bounded outcomes, retry recoverable tool-call failures, and do not conflate prompt compatibility with provider capability status.
- `ai-prompt-management`: synthetic compatibility evaluation limits provider concurrency and preserves inconclusive evidence.
- `admin-settings-ui`: the Provider card displays provider and feature compatibility outcomes without contradictory generic feedback.

## Impact

Affected inventories are `apps/api/src/modules/search/infrastructure/openai-compatible.*`, `apps/api/src/modules/ai-prompts/application/ai-prompt.*`, `apps/api/src/modules/ai-provider/application/ai-provider.draft-service.test-execution.ts`, the provider repository/execution seam, and `apps/web/src/features/organization/ui/ai-provider-*`. Shared result schemas may be refined without a database migration during MVP. The change extends, rather than reopens, `fix-ai-provider-save-feedback`.
