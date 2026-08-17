## Context

The serving path already has the correct high-level decomposition: `ReportAssistantService` asks a planner for a plan, prepares authorized candidates, and asks an answerer to ground a response. Reliability is lost at the protocol and lifecycle seams. The planner adapter negotiates forced tools, temperature retries, strict JSON Schema, and repair; the answer adapter negotiates strict schema or another forced tool; provider activation runs both protocol probes and a multi-request feature evaluation; runtime additionally requires an exact stored prompt/provider evaluation.

Before:

```text
save → capability protocol negotiation → multi-case feature evaluation
     → exact provider/prompt gate → activate
question → stored prompt/provider snapshot → tool/retries/schema fallback
         → retrieval → schema/tool answer → citation repair
```

After:

```text
save → connection + minimal protocol smoke test → activate
question → code-owned prompts → one forced planner tool → validate compact plan
         → authorized retrieval → JSON Mode answer containing Markdown
```

The role-coverage gate, period dual-state invariant, destructive-database guard, and deferred-feature convention are unchanged. No database migration or destructive operation is required.

## Goals / Non-Goals

**Goals:**

- Preserve the full useful query vocabulary for periods, authors, subjects, record kinds, filters, retrieval, grouping, and output intent.
- Make irrelevant plan branches absent rather than filled with empty arrays and nulls.
- Use one provider-supported planner protocol and a text answer protocol.
- Make provider activation depend only on connectivity and the minimal protocols required at runtime.
- Remove prompt database state from the runtime availability decision while retaining prompt administration data for later use.

**Non-Goals:**

- Letting the model make authorization, SQL, database identity, or retrieval-limit decisions.
- Removing semantic retrieval, entity clarification, aggregation, source validation, or embedding-scope preparation.
- Deleting prompt tables or editor UI.

## Decisions

### Use a compact conditional SearchPlan

The shared plan remains strict, but neutral semantics are represented by absence. Period, retrieval, and output are discriminated objects so only fields relevant to the chosen mode are legal. Optional filter collections mean “no constraint” by contract and are normalized once at the application boundary for existing domain consumers. This retains functionality without forcing the model to generate unrelated fields.

Alternative: keep the current exhaustive explicit schema. Rejected because every irrelevant field is another opportunity for a model-generated plan to fail validation.

### Use one forced planner tool

The planner request exposes only `search_report_entries`, forces that named function, and disables parallel calls. The server parses its arguments and may retry once after a protocol/validation failure. It never falls back to `response_format: json_schema` and never sends retrieved evidence back to the planner.

Alternative: use JSON Object Mode for planning. Rejected for the first implementation because Groq Qwen supports local tool calling and the function envelope clearly separates planning from answering.

### Return a minimal JSON Mode grounded answer

The answer request contains the original question and server-built evidence JSON. The model uses widely supported JSON Object Mode to return only `answerMarkdown`, `citedSourceIds`, and `insufficientEvidence`. The server validates the small envelope and source allowlist and performs at most one citation-repair request using the same protocol. No answer tool or strict JSON Schema is sent.

Alternative: plain Markdown with extracted source markers. Rejected because the tiny JSON envelope preserves the existing public answer metadata without requiring provider-specific strict schema support.

### Separate readiness from quality

The blocking provider test performs generation authentication, one planner tool smoke test, one text answer smoke test, usage parsing, and embedding validation. Language, retrieval-choice, aggregation, evidence, injection, and prompt-budget evaluations remain callable diagnostics but do not determine provider lifecycle or availability.

### Serve code-owned prompts

The report assistant constructs its prompt set from versioned source constants. Active provider resolution no longer joins prompt control/evaluation state. Existing prompt revisions remain available to administrators but are explicitly inactive for runtime serving until a later change reintroduces editing with a simpler publication model.

## Risks / Trade-offs

- [Compact plans can omit a meaningful constraint] → Discriminated modes keep required mode-specific values, while focused planner tests cover current/previous week, author, item, blocker, count, summary, and semantic queries.
- [JSON Mode does not guarantee schema compliance] → Parse the tiny envelope with Zod, allowlist citations, and permit one bounded repair.
- [A provider can pass smoke tests but answer poorly] → Surface quality evaluation separately with named failed checks; it is diagnostic rather than a connectivity gate.
- [Stored prompt editor appears misleading] → Mark it as not controlling runtime and show the code-owned prompt version in the admin read model.

## Migration Plan

1. Introduce the compact schema and normalization boundary, then update planner prompts/tests.
2. Switch planner and answer transports to the single protocols.
3. Narrow the blocking capability tester and decouple feature evaluation.
4. Switch runtime resolution to code-owned prompts and provider-only availability.
5. Run unit, integration, type, lint, build, and live Groq/Jina checks before deployment.

Rollback uses the previous application revision; persisted provider and prompt records remain compatible because this change does not delete or reshape them.

## Open Questions

None. The product owner selected the minimal two-model RAG path and deferred runtime prompt editing.
