## Context

The request path is planner → authorized retrieval → optional semantic ranking → grounding → answer/citation repair. `GroundingBundle.evidence` currently embeds complete `SearchCandidate` objects while its budget estimates only human-readable text plus a fixed metadata allowance. Metrics showed roughly 48k input tokens per successful answer despite an 8k context budget. The Mistral SDK already retries 429 and transient 5xx responses; the adapters then discard safe status/retryability information, so the API emits a generic internal error and the web UI describes it as a connection problem.

Before: `SearchCandidate[]` → text-length estimate → complete candidates serialized → Mistral → opaque technical error.

After: `SearchCandidate[]` → compact evidence projection → serialized-size budget → Mistral → typed retryable outcome or preserved technical error.

## Goals / Non-Goals

**Goals:**

- Keep the serialized grounding payload within the configured approximate token budget.
- Preserve all facts needed for grounded summaries, counts, comparisons, citations, and status context without exposing internal IDs or redundant retrieval metadata to Mistral.
- Return a stable `provider_unavailable` product outcome after an exhausted transient provider failure.
- Preserve diagnostic status and operation metadata without logging provider response bodies or report content.

**Non-Goals:**

- Change retrieval, authorization, pgvector ranking, persistence, model selection, or infrastructure.
- Generate an answer without verified evidence.
- Add a second application retry loop on top of the Mistral SDK's bounded retries.

## Decisions

### Project candidates into compact evidence records

Grounding will retain the existing citation metadata and a discriminated record payload containing only answer-relevant fields. Report, period, section, author, subject and lineage IDs are excluded from model evidence; source links remain server-produced from `SourceCitation`. This is preferred to selectively deleting fields during prompt construction because the compact type makes accidental payload growth visible in TypeScript and tests.

### Budget the serialized grounding shape

The builder will estimate tokens from `JSON.stringify` of the same compact bundle shape sent by the prompt. Complete-set aggregates are calculated before evidence limiting, but supporting status facts are limited to facts attached to included evidence. Candidates are accepted only while the resulting serialized bundle remains within the configured budget. For count/comparison output, the complete aggregates remain authoritative and evidence is still bounded; this avoids a separate unverified answer path.

### Treat only transient provider failures as a product outcome

A provider error exposed through the application port will carry operation, optional HTTP status and `retryable`. Status 429, 5xx, timeouts and transport failures are retryable; other 4xx responses remain technical errors because retrying cannot repair invalid credentials or requests. The service converts retryable failures to `provider_unavailable`; adapters continue to rely on the SDK's existing bounded retry policy rather than multiplying retries.

### Present provider unavailability truthfully

The shared outcome union gains `provider_unavailable`. The Lead Sheet renders a native retry action and says the AI service is temporarily unavailable; it does not tell the user to check their own connection.

All load-bearing invariants are preserved: no write path or period state changes, the existing canonical Lead middleware remains unchanged, no destructive database action occurs, and no deferred feature is hidden.

## Risks / Trade-offs

- [Character-based token estimates are approximate] → Serialize the final shape, reserve room by never exceeding the configured estimate, and cover metadata-heavy fixtures.
- [Compact projection can omit a useful field] → Use a discriminated record union and fixture coverage for every candidate kind.
- [Transport failures without status can include local misconfiguration] → Only failures thrown during an established SDK request are classified retryable; boot-time config validation remains fail-fast.
- [New outcome affects exhaustive consumers] → Update the shared schema, web rendering, and contract tests together.

## Migration Plan

No database or infrastructure migration is required. Deploy shared/API/web in the same build, observe assistant outcome and token metrics, and roll back the application image if regressions appear.

## Open Questions

None.
