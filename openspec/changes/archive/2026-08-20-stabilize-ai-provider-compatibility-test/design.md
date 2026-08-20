## Context

The capability tester currently produces a provider-only top-level status, then appends active-feature evaluations and separately converts their boolean `passed` aggregate into revision lifecycle. The execution processor later derives its outcome from the provider-only status. This permits one persisted revision to be `failed` while its execution and both visible provider lanes are `passed`. The UI does not render `generation.featureCompatibility`, so it falls through to a generic provider failure.

Live verification of the saved Groq/Jina revision showed Jina passing consistently at 1024 dimensions, ordinary Groq generation passing, Groq forced planner calls returning HTTP 400 `tool_use_failed`, and a later request returning `rate_limit_exceeded`. Groq documents the model as tool-capable and recommends bounded retry with lower temperature for invalid tool-call generation.

Before: provider probes → provider-only status → concurrent feature probes → boolean merge → lifecycle write; processor independently rereads provider-only status → execution write; UI renders provider lanes only.

After: provider probes → bounded feature probes → one three-state composite result → one repository transition → execution derives from that same result; UI renders provider lanes and feature compatibility separately.

## Goals / Non-Goals

**Goals:**

- Keep provider, feature, lifecycle, and execution outcomes coherent.
- Make recoverable Groq tool generation materially more reliable.
- Preserve bounded safe diagnostics without provider bodies or credentials.
- Prevent capability testing from creating an unnecessary provider request burst.

**Non-Goals:**

- Allow activation after an inconclusive or failed feature evaluation.
- Guarantee success when an external provider is unavailable or quota-exhausted.
- Add provider-specific activation rules or endpoint exceptions.
- Change the active provider during retest.

## Decisions

1. Use the existing three-state vocabulary end to end. The composite status is `failed` if any required provider or feature check fails, otherwise `inconclusive` if any check is inconclusive, otherwise `passed`. A non-active revision becomes `validated`, `failed`, or `draft` respectively; an active revision remains active while retaining the latest test evidence. Adding a new Prisma lifecycle value was rejected because lifecycle eligibility and test evidence already have separate fields.
2. Replace the prompt-compatibility boolean result with a bounded status. An evaluator exception becomes `inconclusive`, not `failed`, because no incompatibility was proven. The capability result's top-level status is recomputed after feature results are attached, and the execution processor consumes that same status.
3. Classify authentication only from HTTP 401/403. Other planner provider errors stay attached to `planner_tool_call`; retryable HTTP/network errors are `inconclusive`, while `tool_use_failed` remains a real planner failure after retries are exhausted.
4. Retry invalid forced tool generation a bounded number of times with lower temperature, then negotiate the same strict search-plan schema through JSON Schema output when the tool protocol remains unusable. Retry transient 429/5xx transport responses with bounded server-hinted delay. Both planner protocols feed the same downstream Zod validation; unlimited retries and provider-specific success bypasses were rejected.
5. Execute synthetic feature checks sequentially through an immutable async reduction. This favors determinism and quota safety over maximum test speed; the provider worker already serializes compatibility jobs.
6. Render a separate Feature compatibility row and a specific terminal message. Historical details remain subordinate to current operation feedback, preserving `fix-ai-provider-save-feedback`.
7. Include the provider revision ID in every provider-test execution identity. Composite fingerprints remain the compatibility-evidence key, but queue deduplication is revision-local; otherwise a newly saved draft with the same fingerprint can instantly inherit an older terminal execution without running a job.
8. Adapt the planner system instruction when negotiating JSON Schema output. The fallback has no tool definition, so it explicitly asks for the `search_report_entries` arguments object rather than leaving the model under a contradictory forced-tool instruction. Both protocols retain the identical schema and downstream validation.
9. Include an explicit base revision ID when saving from an observed revision. Blank credentials may be retained only from that named revision when the corresponding profile and endpoint are unchanged; otherwise a new credential remains mandatory. Falling back only to the active revision was rejected because an organization with no active provider cannot correct or retest its saved draft without pasting secrets again.
10. Keep the English and Russian planner checks focused on language-to-valid-plan behavior by using unambiguous structured list requests. Exact-versus-semantic routing remains covered by its dedicated checks; combining language coverage with an ambiguous “needs attention” concept was rejected because one failure could not identify which capability was incompatible.
11. Use the same revision-scoped execution identity in activation evidence queries. Continue accepting legacy identities only when the execution belongs to the candidate revision. A `preparing` revision with successful finished progress is resumable without repeating embedding work, and the UI gives it priority over newer drafts while disabling competing save/test actions.
12. Treat a passing prompt evaluation as absorbing for one exact provider/prompt/hash/contract/evaluator tuple. A failed or inconclusive tuple may be evaluated again and promoted to passed, but a later nondeterministic result cannot overwrite a pass. Provider activation verifies the immutable passing feature snapshot stored on the candidate revision; the shared evaluation row remains a reusable cache and cannot retroactively revoke revision-owned evidence.
13. When legacy mutable evidence is non-passing, recover exact passing feature evidence from the active provider revision if the new draft has the same generation compatibility identity. Promote the shared tuple to passed before running feature probes. This repairs pre-fix cache damage without copying provider execution outcomes across revisions or weakening revision-local provider capability testing.
14. Treat both `inconclusive` and `incompatible` terminal provider executions as explicitly retryable on the same revision. Reuse queued, running, passed, and configuration-error executions. A visible retry action must create a revision-scoped retry execution instead of returning a terminal incompatible result while claiming that work was queued.

The period dual-state invariant, role-coverage gate, destructive-db guard, and deferred-feature pattern are unchanged. Credentials and provider bodies remain excluded from shared schemas, logs, metrics, and UI.

## Risks / Trade-offs

- [Risk] Sequential probes increase successful test duration. → Mitigation: the work is queued, observable, and runs off the request path.
- [Risk] Retries consume additional quota. → Mitigation: small fixed attempt limits, Retry-After bounds, and no retry for authentication or other deterministic client errors.
- [Risk] Protocol fallback can conceal which structured-output mechanism passed. → Mitigation: persist and display the provider-neutral Structured planner capability while retaining legacy tool-call evidence for historical revisions.
- [Risk] Returning an inconclusive revision to `draft` can look untested. → Mitigation: the persisted test result and UI explicitly show Inconclusive and retry guidance; activation still requires `validated`.
- [Risk] Existing failed rows may coexist with an earlier revision-owned passing snapshot. → Mitigation: activation trusts the exact immutable snapshot, while a later successful retest promotes the shared row without destructive backfill.
- [Risk] Revision-scoped identities create one execution per saved duplicate draft. → Mitigation: deduplication and inconclusive retry reuse remain intact within each revision, while cross-revision reuse is forbidden because lifecycle and visible feedback are revision-owned.
- [Risk] Protocol-specific wording could drift from the shared search-plan contract. → Mitigation: only the output-envelope instruction changes; the same generated JSON Schema and Zod validation remain authoritative.
- [Risk] A stale browser can name a revision that was discarded. → Mitigation: saving fails explicitly when the base revision no longer exists and never searches for an implicit credential source.
- [Risk] A process interruption can occur after semantic preparation but before the active pointer transaction. → Mitigation: persist finished progress, allow explicit activation resume, and skip already completed preparation.
- [Risk] A nondeterministic synthetic check can disagree across identical retries. → Mitigation: failures remain retryable, while the first exact passing result is monotonic and reused without another provider request.
- [Risk] Recovering active-revision evidence could be mistaken for cross-revision provider-test reuse. → Mitigation: only prompt-feature evidence for the exact generation identity and prompt tuple is recovered; generation, embeddings, lifecycle, and durable execution remain tested and persisted per revision.
- [Risk] Retrying an incompatible revision consumes provider quota. → Mitigation: retries occur only after an explicit administrator action and retain revision-local execution history.

## Migration Plan

Deploy shared/API/web changes together, restart the API worker, and retest retained candidate revisions. No schema migration or destructive operation is required. Rollback restores prior aggregation and retry behavior; stored JSON remains schema-compatible.

## Open Questions

None.
