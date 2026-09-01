# Report assistant architecture

The Report Assistant answers a Lead's questions using only report records the
server has already authorized. It is an optional capability: provider failures
or an unconfigured provider must not affect editing, submitting, publishing, or
exporting reports.

## Product surfaces

- **Admin → AI → Provider** owns the global configure → test → activate
  lifecycle and keeps advanced revision details secondary.
- **Admin → AI → Features** owns the active prompt bundle for each
  code-registered feature.
- **Report chat** is available only in the Lead report toolbar and returns
  bounded outcomes, Markdown answers, and server-validated citations.

## Runtime flow

1. Resolve one enabled provider revision and one current active prompt bundle
   under a repeatable-read snapshot.
2. Convert the question into the strict shared `SearchPlan` contract.
3. Select live or immutable published sources and apply authorization before
   projecting candidates.
4. Apply exact filters. Semantic ranking, when requested, receives only the
   already-authorized candidate set.
5. Build a compact grounding bundle, generate an answer, and reject every
   citation that does not point to supplied evidence.

See [logical-flow.mmd](./logical-flow.mmd) for the outcome flow and
[architecture.mmd](./architecture.mmd) for component boundaries.

## Load-bearing invariants

- The model never chooses SQL, database IDs, authorization, period source, or
  vector limits.
- Current open/reopened reports come from live tables; published history comes
  only from `Report.publishedSnapshot`.
- `SemanticEmbedding` stores hashes, provider scope, and vectors—not report
  text, record identities, ACLs, credentials, prompts, or generated answers.
- Runtime never falls back to compiled credentials or prompt text. Missing,
  disabled, stale, or corrupt control-plane state returns a bounded unavailable
  outcome.
- Questions, answers, report text, credentials, and embeddings are excluded
  from logs and metric labels.

Durable behavior is specified in `openspec/specs/ai-*`,
`openspec/specs/authorized-report-retrieval`,
`openspec/specs/lead-assistant-provider-resilience`,
`openspec/specs/lead-report-assistant`, and
`openspec/specs/semantic-embedding-cache`. Code and those specifications are
the source of truth; historical rollout and provider-research documents are not
kept in the repository.
