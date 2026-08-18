## Why

The working report-assistant pipeline was deliberately simplified after the previous editor/runtime integration proved unreliable. The current planner, retrieval, answer, and citation-repair path works with code-owned prompts, while the existing editor still stores revisions that do not serve requests. We need to move the exact current prompt set into the editor without reviving the removed LLM integration or allowing stale revisions to reach runtime.

## What Changes

- Import the exact four prompt slots used by the current code pipeline into a controlled editor baseline; existing stale revisions are retained for audit but cannot become serving revisions.
- Make the active editor revision the runtime prompt source after it passes the current catalog, serving-contract, and content-integrity checks. Prompt activation must not call an LLM or depend on provider evaluation.
- Preserve the current planner tool protocol, compact search contract, JSON-mode grounded answer protocol, citation validation, retrieval authorization, provider adapters, and embedding-only resolution.
- Resolve one immutable provider/prompt snapshot per assistant request so planner, repair, answer, and citation-repair calls share the same prompt set.
- Update prompt lifecycle API/UI semantics to distinguish current serving revisions from legacy or incompatible history and to activate saved prompt text directly.
- **BREAKING** Remove the compiled prompt text as a serving fallback after the imported baseline is verified; a missing or incompatible serving revision fails closed as `ai_not_configured`.

### Non-goals

- Reintroducing the old LLM integration, protocol negotiation, strict-schema fallback, or removed editor/runtime behavior.
- Changing the current RAG flow, search-plan schema, provider adapters, answer envelope, citation checks, authorization, or embedding pipeline.
- Deleting historical prompt revisions or weakening immutable lifecycle and audit rules.
- Adding prompt evaluation, quality scoring, provider probes, or live/synthetic LLM checks to the editor workflow. Existing compatibility/evaluation infrastructure, if retained for other internal diagnostics, is not part of prompt activation or runtime availability.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-prompt-management`: Current editor revisions become the controlled serving source, with an exact code-to-editor baseline import, legacy revision protection, and serving-safe lifecycle/read models.
- `lead-report-assistant`: Runtime resolves the active provider and compatible editor prompt revision as one immutable request snapshot while preserving the working current pipeline.

## Impact

Affected areas include `apps/api/src/modules/search/application/ai-runtime.resolver.ts`, `ai-runtime-configuration.repository.ts`, the AI prompt catalog/service/repository/bootstrap/lifecycle modules, shared prompt schemas and tRPC procedures, and the AI settings editor under `apps/web/src/features/organization/ui/`. The change requires migration/bootstrap and golden-contract tests proving that the imported baseline matches the current prompts before compiled serving text is removed. Existing provider configuration behavior remains unchanged.
