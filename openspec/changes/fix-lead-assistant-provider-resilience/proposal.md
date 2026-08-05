## Why

The lead assistant can retrieve authorized report records and still return “The assistant could not complete that search” because the generated Mistral request is much larger than the configured context budget and provider failures are collapsed into a misleading connection error. This was reproduced against the local API and is visible in `apps/api/.logs/app.log`; the affected paths are `context-builder.ts`, `report-assistant.prompts.ts`, and the Mistral adapters.

## What Changes

- Build a compact, explicitly shaped evidence payload for answer generation instead of serializing complete search candidates.
- Enforce the answer-context budget against the payload that is actually sent to Mistral.
- Keep deterministic aggregate questions small by grounding the answer in computed aggregates rather than unrelated record detail.
- Preserve safe provider failure metadata, apply bounded retry behavior only to transient failures, and map exhausted transient failures to an accurate retryable assistant result.
- Add regression coverage for metadata-heavy candidates, provider rate limiting, timeouts, and non-retryable failures.

### Non-goals

- Changing authorization, structural filtering, semantic ranking, model IDs, or embedding dimensions.
- Adding durable chat history or silently falling back to an ungrounded answer.
- Hiding mandatory configuration behind defaults.

## Capabilities

### New Capabilities

- `lead-assistant-provider-resilience`: Bounded answer prompts and truthful, recoverable behavior when the configured AI provider is temporarily unavailable.

### Modified Capabilities

None.

## Impact

The change affects the API search domain/application layers, Mistral adapters, assistant response contract and lead chat error presentation. It adds no database migration or dependency and keeps existing authorization and retrieval semantics intact.
