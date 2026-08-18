## Context

The current report-assistant pipeline is the compatibility baseline. It uses
the compact planner contract, one forced `search_report_entries` tool call,
authorized server-side retrieval, JSON Object Mode for grounded answers,
citation validation/repair, and provider-specific adapters. Its prompt text is
currently defined in code, while the existing editor stores revisions that do
not serve requests.

The goal is deliberately narrow: copy the exact current code prompt text into
the editor and make that stored text the runtime source. The previous editor
integration and its LLM/evaluation assumptions are not part of this change.
The editor may own prompt wording; code continues to own every structural
contract and runtime control.

Current flow:

```text
Lead question -> active provider + code prompt constants -> current runtime protocols
```

Target flow:

```text
Lead question
  -> repeatable-read active provider + active current editor revision
  -> catalog validates and composes stored prompt text
  -> unchanged runtime protocols
```

The period dual-state invariant is not touched. The canonical admin
role-coverage middleware remains required for prompt procedures. No provider
or prompt LLM call is made by saving, activating, or resolving a prompt.

## Goals / Non-Goals

**Goals:**

- Import the exact four prompt texts currently used by the working runtime into
  an editor baseline.
- Make saved current-contract editor revisions directly activatable and
  serve them through the existing runtime snapshot.
- Keep old revisions inspectable, but prevent revisions from the removed
  integration from being activated or resolved.
- Preserve the current planner, retrieval, answer, citation, authorization,
  provider, and embedding behavior.
- Keep code responsible for slots, schemas, composition, versions, limits,
  tool choice, output validation, and data access controls.

**Non-Goals:**

- Adding an “Evaluate prompt” action, prompt quality scoring, provider probes,
  synthetic test conversations, or live LLM checks to the editor workflow.
- Recreating the previous LLM integration or its protocol negotiation and
  fallback behavior.
- Changing `SearchPlan`, retrieval semantics, answer envelopes, citation
  rules, provider adapters, or embedding generation.
- Allowing prompt text to control authorization, database identifiers,
  retrieval limits, tool schemas, or output validation.
- Deleting prompt history or weakening immutable lifecycle, audit, and role
  checks.

## Decisions

### Keep the catalog as the runtime contract and move only prompt text to storage

`AiFeaturePromptCatalog` remains responsible for registered feature keys,
required slots, strict content validation, size limits, slot ordering,
contract/composer versions, and deterministic hashing. `AiComposedPromptSet`
remains the only prompt shape accepted by the current planner and answer
adapters.

The database/editor owns the complete text for each editable slot. The code
constants are read only by the one-time handoff/import procedure and its exact
baseline assertions; runtime resolution never consults them as a fallback.

### Establish an explicit current-serving identity

Prompt revisions carry a catalog-owned serving-contract identity. The handoff
and all drafts derived from a current revision receive it. Activation, restore,
and runtime resolution require an exact match. Existing rows without the
identity remain readable as legacy history and cannot serve.

This identity is separate from the content hash: editor wording may change the
hash while remaining within the same code-owned runtime contract.

### Import and activate the current baseline without evaluation

The handoff composes the four code prompts, verifies every slot and the
canonical hash, persists an idempotent system-authored revision, and activates
that revision directly. Re-running the handoff reuses the same exact revision
and repairs an incomplete pointer/lifecycle state. It does not invoke a
provider, an evaluator, or an assistant request.

### Resolve one provider/prompt snapshot

`AiRuntimeConfigurationRepository.resolveReportAssistant()` reads the enabled
active provider and active prompt control/revision under one repeatable-read
transaction. It validates the serving identity, stored shape, current catalog
versions, lifecycle, and content hash, then returns the composed prompts with
the provider. Missing or invalid state returns the existing
`ai_not_configured` outcome before retrieval. There is no evaluation lookup.

`resolveExact()` remains provider-only for embedding workers. The generation
client cache remains separated from embedding-only clients.

### Preserve server-owned runtime controls

The adapters continue to receive the same `AiComposedPromptSet` and keep the
forced planner tool, bounded repair, JSON Object Mode answer, citation repair,
source allowlist, retrieval authorization, and output validation. Prompt text
cannot change those controls or grant additional access.

Existing evaluation tables or internal compatibility code may remain for
historical data and unrelated diagnostics, but they are not required for
prompt save, activation, availability, or serving.

### Make lifecycle and UI semantics direct

The editor keeps draft, activate, restore, discard, audit, and history flows.
Current-contract drafts can be activated after structural validation; restore
of current-contract history also does not require evaluation. Legacy rows are
inspection-only. The settings copy explains that the active editor version
serves Report Assistant and that runtime protocols remain code-owned. There is
no Evaluate button or evaluation prerequisite.

## Risks / Trade-offs

- [A stale stored revision is activated] -> Require the current serving
  identity, composed content hash, and allowed lifecycle in both the service
  precheck and the pointer-swap transaction.
- [The imported baseline differs from code] -> Compare every slot and the
  canonical hash before activating; leave the existing pointer unchanged on
  mismatch.
- [The database is not ready] -> Runtime fails closed as `ai_not_configured`
  rather than falling back to compiled or legacy prompt text.
- [A prompt edit changes answer quality] -> Keep immutable revisions, direct
  restore, audit metadata, and human review in the editor. Quality evaluation
  is intentionally outside this change.
- [Embedding workers reuse generation state] -> Keep provider-only
  `resolveExact()` and the existing cache identity separation.

## Migration Plan

1. Add the serving-contract identity and legacy classification without changing
   provider or generation behavior.
2. Run the idempotent handoff against each environment. Verify the imported
   bundle slot-by-slot and by canonical hash, then activate it directly.
3. Deploy the runtime resolver and editor lifecycle changes. The handoff is
   safe to rerun and does not alter provider or embedding state.
4. Verify with mocked database/runtime fixtures and the repository/UI test
   suites. No provider request is needed for this migration.
5. Keep the one-time code-baseline importer available for controlled
   provisioning; do not consult code constants during normal runtime serving.

Rollback is application-version based. Reverting the application does not
require deleting prompt/provider rows. If a current-contract editor revision
is unsuitable, restore a previous current-contract revision through the same
direct lifecycle operation.

## Open Questions

None blocking.
