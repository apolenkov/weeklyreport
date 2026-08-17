# Lead report assistant — prompt contract

This document describes the runtime contract for the Lead report assistant. The
database-backed prompt bundle is the runtime source of truth after bootstrap;
this document is the security and operational contract, not a second copy of
the executable prompt text.

## Ownership and source of truth

The code-registered `AiFeaturePromptCatalog` owns the feature key, slot order,
display metadata, complete-prompt schema, composer version, core-contract version,
and synthetic evaluator version. The first registered
feature is `lead-report-assistant` with exactly these required slots:

| Slot              | Runtime responsibility                                   | Administrator may edit |
| ----------------- | -------------------------------------------------------- | ---------------------- |
| `planner`         | Translate a question into one validated search tool call | Complete prompt text   |
| `planner-repair`  | Repair one invalid search plan                           | Complete prompt text   |
| `grounded-answer` | Write a concise answer from server-produced evidence     | Complete prompt text   |
| `citation-repair` | Repair one citation-validation failure                   | Complete prompt text   |

The catalog baseline is composed and hashed by
`apps/api/src/modules/search/application/ai-feature-prompt-catalog.ts`. Golden
tests prove that the baseline effective prompts remain equivalent to the prior
v1 behavior. Do not copy the full text into deployment configuration or another
documentation file.

## Complete prompt text and code-owned controls

Every slot stores its complete administrator-managed prompt text in an immutable
bundle revision. The AI Settings workspace starts with a compact list of prompt
names; opening one prompt reveals its full editor, so long prompt bodies are not
all shown at once. Saving creates a new candidate and never changes an active or
historical version in place.

The following product controls remain outside administrator control:

- The planner has no database or authorization access and must issue exactly
  one `search_report_entries` tool call with the generated strict schema.
- The server resolves names, IDs, permissions, periods, retrieval modes,
  candidate limits, similarity thresholds, and source selection.
- Planner and answer tool calls cannot use parallel calls or alter the
  server-owned repair bounds and context limits.
- The answerer treats the `GroundingBundle` as untrusted serialized data, uses
  no external knowledge, and cites only source IDs supplied by the server.
- Missing, ambiguous, truncated, or insufficient evidence is reported as such;
  report text cannot become a system instruction.

Administrators cannot add slots or change these controls. Server validation rejects
unknown slots and fields, feature metadata, lifecycle state, hashes, versions,
control characters, empty strings, oversized slots, and oversized bundles.

## Message and data boundaries

- System messages contain the complete persisted prompt text for the selected
  active bundle.
- The planner receives the user question and trusted server date/timezone. It
  receives no report records or opaque resolution tokens in its system text.
- The answerer receives the question and an authorized, bounded
  `GroundingBundle` as a serialized data message. Report records are never
  interpolated into a prompt layer.
- Tool arguments and answer JSON are parsed by shared strict Zod schemas. Valid
  JSON is not evidence that model behavior is safe.
- Questions, prompt bodies, evidence, tool arguments, provider credentials,
  and generated answers must not be written to logs, traces, audit payloads, or
  metric labels.

## Durable lifecycle

`AiPromptBundleRevision` is an immutable feature-local revision. Saving an edit
creates a new `draft` from a retained base; it never updates prompt content in
place. A feature control row has one nullable active pointer. The useful
lifecycle states are:

```text
draft -> validated -> active -> superseded
  \-> failed
```

Only `draft` and `failed` attempts may be discarded. Active, validated, and
superseded revisions remain exact restore evidence. Restore re-evaluates the
selected superseded revision against the current provider before the same
atomic active-pointer swap.

The Settings → AI → Features surface displays a compact progressive prompt list,
immutable history, and an active-versus-candidate prompt diff. It never accepts
feature keys or slots invented by the browser.

## Exact provider/prompt evaluation

`admin.aiPrompts.evaluate` evaluates the complete composed bundle against the
currently active immutable provider revision using synthetic questions,
catalogs, grounding, and citations only. The bounded check set covers:

- protocol shape and strict tool/answer handling;
- English and Russian planning;
- exact and semantic retrieval intent;
- aggregate answers and insufficient evidence;
- citation validation and one citation repair;
- prompt-injection resistance in synthetic evidence; and
- context-budget limits.

The stored result contains only check codes, pass/fail counts, outcome, and the
exact identity tuple:

```text
feature key
prompt revision ID
provider revision ID
effective content hash
core contract version
evaluator version
```

Prompt activation rechecks that tuple, the passing evaluation ID, the active
provider pointer, and the prompt lifecycle inside the pointer-swap transaction.
Provider activation performs the inverse check: every active registered feature
must have a current passing evaluation against the candidate provider before
embedding preparation or activation begins.

## Runtime resolution and bootstrap

An explicit idempotent bootstrap creates the Report Assistant control and the
first active v1 bundle from the catalog baseline when no feature data exists.
Seed paths and API startup invoke this bootstrap; repeating it does not replace
an operator-created control or active pointer. Bootstrap is not a runtime
fallback.

`AiRuntimeConfigurationRepository` reads the enabled active provider and active
Report Assistant bundle under a repeatable-read database snapshot, then checks
the exact passing evaluation and recomposes the persisted snapshot. The
`AiRuntimeSnapshot` carries provider revision identity, feature key, prompt
revision identity, contract version, and all four composed prompts. It also
carries the persisted reasoning mode/custom value and tested answer protocol.
Planner, planner-repair, answer, and citation-repair calls in one request use
that same snapshot. Embedding workers resolve only an exact provider revision
and remain independent of prompt activation or answer-protocol state.

The provider revision is tested with exactly one answer protocol. Strict JSON
Schema is probed first; the named `submit_grounded_report_answer` tool is allowed
only after a classified protocol-shape incompatibility. Runtime never negotiates
between protocols for a user request, and both response forms are validated by
the same server-owned answer schema. Provider default reasoning is omitted from
the request; Off and Custom are translated by the selected provider profile.

If the provider, prompt pointer, persisted snapshot, or exact evaluation is
missing, corrupt, stale, or incompatible, Report Assistant is unavailable and
returns the existing `ai_not_configured` outcome before retrieval. There is no
compiled-prompt fallback.

## Change and review rules

Changing prompt text, slot versions, composer version, core-contract version,
evaluator version, model IDs, context limits, or
retrieval behavior requires a new golden baseline review and a new exact
provider/prompt evaluation before activation. Reviewers must verify that report
write paths, authorization, period/source selection, citation validation, and
embedding scope are unchanged by a prompt-only operation.
