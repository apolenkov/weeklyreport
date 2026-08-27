# Execution plan

## Solution approach

Build a zero-loss, evidence-first reconstruction in a new dated directory under
`/Users/wrk/work/customreport-archive/`. Keep raw Codex JSONL files in place and
derive a frozen source manifest, a redacted owner-event registry, a linked
requirement/decision ledger, a current-tree reconciliation, two backlogs and a
dependency-ordered roadmap. Deterministic accounting proves coverage and link
integrity; semantic decisions remain reviewable and receive an independent final
review.

The existing archives, `/Users/wrk/work/codex-backlog/Backlog.md`, and the other
untracked goal package are inputs only. This goal does not update product code,
OpenSpec, Git refs, the canonical backlog, Jira, Confluence, GitHub or runtime
systems.

## Ordered steps

### 1. Freeze the source universe and research decisions

Create
`/Users/wrk/work/customreport-archive/2026-08-27-repository-history-backlog-reconstruction/`
and record the initial research boundary in:

- `SOURCE-SNAPSHOT.json` and `SOURCE-SNAPSHOT-RU.md`;
- `RESEARCH-DECISIONS-RU.md`;
- `scripts/session-inventory.ts`;
- an entry in `/Users/wrk/work/customreport-archive/INDEX.md`.

Freeze, without fetching or changing refs:

- the current repository path, branch, commit, raw tree, complete status and
  tracked-file digest;
- `openspec list --json`, all current `openspec/specs/` and
  `openspec/changes/` paths, task counts and content hashes;
- the existing cross-session backlog's Git identity, status, validator output
  and record IDs;
- every JSONL path under `/Users/wrk/.codex/sessions` and
  `/Users/wrk/.codex/archived_sessions`, including every embedded
  `session_meta` identity;
- historical CustomReport archive roots and every known Air source identity;
- availability of requested read-only GitHub, Jira and Confluence evidence.

The research log compares at least these alternatives before selecting the
method: keyword-only versus metadata-plus-semantics source selection;
deduplicated-only versus zero-loss layered feedback; one mixed backlog versus
linked product/process backlogs; chronological versus dependency/risk
prioritization; and historical-claim inheritance versus exact-tree status
recalibration. It also records the official OpenAI multi-source feedback and
durable-goal guidance as secondary workflow research, while keeping local raw
sessions and repository files as the factual authority.

Verification:

```bash
pnpm exec tsx /Users/wrk/work/customreport-archive/2026-08-27-repository-history-backlog-reconstruction/scripts/session-inventory.ts --check
git rev-parse HEAD HEAD^{tree}
git status --porcelain=v1 --untracked-files=all
openspec list --json
/Users/wrk/work/codex-backlog/scripts/backlog.ts validate
```

The inventory check must report zero JSON parse failures, unique file and
session identities, matching file counts and hashes, and an explicit state for
every source: `INCLUDED`, `EXCLUDED_WITH_REASON`, `INACCESSIBLE` or
`PENDING_REVIEW`.

### 2. Discover relevant sessions without keyword-count inflation

Use a reproducible finder pass over the frozen manifest. Start with direct
working-directory and session-link evidence for all current and historical
CustomReport/Weekly Report roots, then inspect actual
`event_msg.payload.type == "user_message"` events for semantic relevance.
Subtract repeated injected instruction blocks and quoted assistant/tool content
from product-feedback counts, but retain them once when they establish an owner
process decision. Do not infer relevance merely because a rollout repeats the
repository instructions.

Write:

- `SOURCE-COVERAGE.jsonl` and `SOURCE-COVERAGE-RU.md`;
- `SESSION-SELECTION-DECISIONS.jsonl`;
- `INACCESSIBLE-SOURCES-RU.md`.

Seed the finder with, but independently recheck, these historical sources:

- `2026-08-11-zero-loss-goal-audit/SESSION-PROVENANCE.md`;
- `2026-08-16-cr001-history-reconciliation/PRO-ROOT-COVERAGE-MANIFEST.md`;
- `2026-08-17-goal-and-session-audit/OWNER-FEEDBACK-REGISTRY-RU.md`;
- `2026-08-09-total-sdlc-goal-reconstruction/USER-REQUIREMENTS-LEDGER.md`;
- `2026-08-09-total-sdlc-goal-reconstruction/RESTORED-GOAL.md`.

Known Air IDs and their last observed hashes remain explicit required-source
rows. If `/Users/ap` or an owner-supplied export is unavailable, mark them
`INACCESSIBLE`; do not copy historical Air conclusions into current proof.

Verification:

```bash
pnpm exec tsx /Users/wrk/work/customreport-archive/2026-08-27-repository-history-backlog-reconstruction/scripts/session-inventory.ts --verify-selection
```

The check must reconcile all frozen files, all selected and excluded sessions,
all embedded session IDs, and every inaccessible Air identity with no orphaned
or multiply dispositioned source row.

### 3. Extract and classify every substantive owner event

Implement `scripts/extract-owner-events.ts` as a streaming parser over selected
JSONL files. Use only owner `user_message` events as direct intent; assistant
messages, compacted summaries, quoted previous turns and tool output are
context, never new owner events. Give every event a stable identity derived from
source file identity plus source order, and retain timestamp and SHA-256 of the
exact message bytes.

Write:

- `OWNER-EVENTS.jsonl` with redacted text and provenance;
- `OWNER-FEEDBACK-REGISTRY.jsonl` and `OWNER-FEEDBACK-REGISTRY-RU.md`;
- `REDACTION-REPORT.json` without secret values;
- `CLASSIFICATION-QUESTIONS-RU.md` for genuinely ambiguous semantics.

Run two semantic passes after deterministic extraction:

1. a broad feedback finder that classifies requirement, decision, problem,
   positive/neutral/negative feedback, question, idea, process instruction,
   superseded/rejected intent, duplicate emphasis and out-of-scope content;
2. a contradiction/remainder finder that searches for lost emphasis,
   misunderstood corrections, conflicting decisions, unlinked praise or
   criticism, and events assigned only through an assistant claim.

Repeated messages remain separate events. Deduplication occurs only in the
derived layer, and every cluster retains all supporting and conflicting event
IDs. Credential-shaped content is replaced with typed redaction markers before
any derived artifact is persisted.

Verification:

```bash
pnpm exec tsx /Users/wrk/work/customreport-archive/2026-08-27-repository-history-backlog-reconstruction/scripts/extract-owner-events.ts --check
```

The check must prove stable hashes and ordering, zero copied secrets, and
exactly one terminal disposition for every substantive event. A stratified
manual sample must cover every source root, time period and feedback type.

### 4. Build the requirement, decision and feedback ledgers

Derive, without deleting source events:

- `REQUIREMENT-DECISION-LEDGER.json` and
  `REQUIREMENT-DECISION-LEDGER-RU.md`;
- `FEEDBACK-CLUSTERS-RU.md`;
- `MUTUAL-UNDERSTANDING-RETROSPECTIVE-RU.md`.

Each derived record must include stable ID, faithful normalized meaning,
feedback types, all source-event links, conflicting or superseding evidence,
decision history, expected behavior, scope/non-goals, and whether it is
actionable product work, actionable collaboration/process work, an inbox item,
or terminal history. The retrospective identifies recurring misunderstanding
patterns and concrete prevention rules without converting process criticism
into product requirements.

Verification is a denominator join: every substantive event appears in exactly
one terminal disposition and every derived record resolves to at least one
valid source event. Historical UR/F records are mapped to the new IDs or listed
as unmapped with a reason.

### 5. Reconcile the ledgers against the current repository and systems

Freeze one reconciliation commit/tree at the start of this step. If the
canonical worktree changes during the analysis, inspect a disposable
`git archive` extraction and record a final delta rather than silently mixing
trees.

Perform both directions:

- **History to repository:** locate current code, tests, specs, active or
  archived OpenSpec changes, Git commits and source-bound evidence for every
  actionable owner requirement.
- **Repository to history:** account for every current OpenSpec change, durable
  spec and major maintained workstream, identifying work with no recovered
  owner-intent source, obsolete paths and historical path assumptions such as
  the now-absent `customreport-exemplary` checkout.

Use available GitHub, Jira and Confluence connectors only for read-only status
verification of already linked records. Do not let an external issue create a
new owner requirement without conversation evidence. Do not run destructive DB,
Redis, Docker or credential operations. Expensive live/runtime acceptance is
not required for backlog reconstruction; where fresh current evidence is
absent, keep the item `UNKNOWN`, `CLAIMED_DONE`, `PARTIAL` or `OPEN`.

Write:

- `CURRENT-STATE-MATRIX.json` and `CURRENT-STATE-MATRIX-RU.md`;
- `REPOSITORY-ORPHANS-RU.md`;
- `EVIDENCE-INDEX.jsonl`;
- `UNCERTAINTY-REGISTER-RU.md`.

Each material status must be exactly one of `CURRENT_PROVEN`,
`HISTORICALLY_PROVEN`, `CLAIMED_DONE`, `PARTIAL`, `OPEN`, `BLOCKED`,
`SUPERSEDED` or `UNKNOWN`, with separate `CODE`, `TEST`, `LIVE`, `REVIEW`,
`REMOTE` and `SOURCE` evidence fields. Current proof must bind the exact frozen
commit/tree; historical artifacts retain their original SHA boundary.

Verification:

```bash
openspec list --json
git log --all --date=iso-strict --format='%H%x09%aI%x09%s'
pnpm exec tsx /Users/wrk/work/customreport-archive/2026-08-27-repository-history-backlog-reconstruction/scripts/validate-reconstruction.ts --current-state
```

### 6. Produce the master backlog and roadmap preview

Generate, in Russian with English IDs and machine fields:

- `PRODUCT-BACKLOG.json` and `PRODUCT-BACKLOG-RU.md`;
- `PROCESS-BACKLOG.json` and `PROCESS-BACKLOG-RU.md`;
- `ROADMAP-RU.md`;
- `EXECUTIVE-STATUS-RU.md`.

Every actionable item contains sources, evidence-calibrated status, owner,
priority rationale, dependencies, next action, measurable acceptance condition
and whether it blocks another item. Cross-link process failures to affected
product records. Keep uncommitted ideas in a visible inbox and terminal
superseded/rejected items in history.

Order the roadmap by prerequisites, blocking effect, owner impact, risk and
uncertainty reduction:

1. restore missing truth and Air coverage;
2. close current blockers and resolve contradictory status claims;
3. finish accepted current product/OpenSpec work;
4. address collaboration/process failures that cause repeated loss or rework;
5. schedule later improvements and retain deferred ideas without implying
   implementation authority.

Do not update `/Users/wrk/work/codex-backlog/Backlog.md`. Include a separate
`CANONICAL-BACKLOG-IMPORT-PREVIEW.md` so the owner can approve a later scoped
import.

### 7. Validate mechanically and review independently

Implement `scripts/validate-reconstruction.ts` to check:

- source-manifest accounting and hashes;
- unique event, requirement and backlog IDs;
- allowed statuses and feedback types;
- source-event-to-ledger and ledger-to-backlog links;
- exactly one terminal disposition per substantive event;
- no actionable item without evidence, next action and acceptance condition;
- no missing required deliverable or broken internal link;
- explicit accounting for every inaccessible source;
- absence of unredacted credential-shaped values in generated artifacts.

Run:

```bash
pnpm exec tsx /Users/wrk/work/customreport-archive/2026-08-27-repository-history-backlog-reconstruction/scripts/validate-reconstruction.ts --all
git diff --check -- goals/repository-history-backlog-reconstruction
```

After deterministic checks pass, request an independent Sol/high review of a
frozen artifact digest. The reviewer checks semantic fidelity, source coverage,
status calibration, missing positive/neutral/negative feedback, contradiction
handling, roadmap coherence and authority boundaries. Record the verdict and
all dispositions in `INDEPENDENT-REVIEW-RU.md`; revise and repeat until approved.

### 8. Close with an honest coverage statement and handoff

Seal final artifact hashes, update the external archive index, and write
`FINAL-COVERAGE-AND-HANDOFF-RU.md`. The handoff reports:

- frozen and final source denominators;
- accounted, excluded and inaccessible counts;
- product/process backlog and status totals;
- current repository commit/tree and any post-freeze drift;
- what is locally complete versus cross-machine or live-system incomplete;
- the exact owner approval needed before importing the preview into the
  canonical backlog.

The goal may complete with inaccessible sources only when they remain explicit
and the package does not claim cross-machine completeness. It may not complete
with an unaccounted discovered source, an undispositioned substantive event, a
broken evidence link, an unreviewed actionable item or a failed validator.

## Risks and open questions

- **Air was inaccessible during planning, then became available during execution.**
  The final package therefore uses a complete read-only Air capture with hashes
  and dispositions. Cross-machine completeness is bound to that capture time;
  the later read-back failed after Air disconnected, so later drift is unknown.
- **The corpus is append-only.** Session files can grow while being analyzed.
  Freeze file sizes and hashes, then run a supplement scan before closeout.
- **Broad keyword search is misleading.** Repository instructions are repeated
  in nearly every rollout. Selection must use metadata, direct owner-event
  semantics and an exclusion ledger.
- **Quoted and compacted content can double-count intent.** Only direct
  `user_message` events create source events; every other representation is
  contextual evidence.
- **Historical paths and statuses drifted.** The old
  `/Users/wrk/work/customreport-exemplary` path is absent, the live repository
  is `/Users/wrk/work/weeklyreport`, and old backlog/OpenSpec links require
  remapping before use.
- **The current worktree already contains unrelated untracked goal files.** Do
  not edit, stage or delete the other goal package; restrict writes to this
  goal directory and the new external archive directory.
- **Semantic completeness is not purely mechanical.** Deterministic denominators
  and joins reduce loss, but faithful interpretation and prioritization require
  independent review and visible uncertainty rather than invented certainty.
