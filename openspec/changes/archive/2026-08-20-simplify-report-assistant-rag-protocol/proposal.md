## Why

Administrators can configure generation and embedding providers that answer successfully, yet activation remains blocked by a large, intermittent feature-evaluation workflow. The report assistant's simple planner → authorized retrieval → grounded answer path is obscured by strict-schema fallbacks, verbose planner arguments, editable-prompt lifecycle gates, and product-quality checks coupled to connection testing (see `openai-compatible.adapters.ts`, `ai-prompt.synthetic-probe.ts`, and the existing AI provider/prompt specs).

## What Changes

- **BREAKING** Replace the verbose all-fields-required `SearchPlan` wire shape with a compact, typed plan that preserves periods, authors, subjects, record kinds, filters, retrieval mode, and output intent while omitting irrelevant fields.
- Use exactly one forced `search_report_entries` tool protocol for planning, with at most one bounded retry for malformed or rejected tool output and no strict JSON-schema fallback.
- Send the original question plus retrieved evidence to the answer model in JSON Object Mode and accept a minimal `{ answerMarkdown, citedSourceIds, insufficientEvidence }` envelope; do not require a forced answer tool or strict structured output.
- Separate blocking connection/protocol smoke checks from non-blocking product-quality evaluations.
- Resolve report-assistant prompts from versioned code-owned constants at runtime. Remove prompt-revision evaluation from provider activation and runtime availability gates while retaining the stored prompt editor data for later reintroduction.
- Keep authorization, entity resolution, retrieval limits, embedding validation, and citation allowlisting server-owned.

### Non-goals

- Removing supported report periods, authors, subjects, record types, filters, semantic retrieval, aggregation, or citations.
- Allowing the model to generate SQL, database identifiers, authorization decisions, or provider configuration.
- Deleting persisted prompt revision data or the administrative editor in this change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `authorized-report-retrieval`: Compact planner contract with conditional fields and server-owned neutral semantics.
- `lead-report-assistant`: One forced planner tool followed by authorized retrieval and a grounded answer returned through JSON Object Mode.
- `ai-provider-configuration`: Activation-blocking smoke checks are separated from non-blocking quality evaluation.
- `ai-prompt-management`: Runtime uses code-owned prompts and no longer requires an exact stored provider/prompt evaluation.

## Impact

The change affects shared assistant schemas, OpenAI-compatible planner and answer adapters, provider capability testing, runtime resolution, prompt administration read models, and their API/web tests. Existing draft prompt rows remain stored but are not part of the serving path. MVP freedom permits the shared wire contract and internal interfaces to change directly.
