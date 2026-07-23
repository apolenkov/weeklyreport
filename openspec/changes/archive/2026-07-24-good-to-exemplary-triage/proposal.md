# Good → Exemplary Triage (Decision)

## Why

The 2026-07-22 mass review graded 1029 files **good** — clean enough to
ship, below **exemplary**. 422 of them carry at least one **minor** finding;
513 minor findings in total. Fixing all 513 blindly would burn a large
budget on things that may in fact be the house norm (e.g. a `?? "18"`
defensive fallback, an integration test labeled "integration"), while
missing the ones that are genuine debt.

This is a **DECISION change, not an implementation change**. Its job is to
put the 513 findings in front of **Sasha** as a small set of recurring
**classes** and get a per-class ruling:

- **fix-in-waves** — this class is real debt; schedule a wave to clear it.
- **ratify-as-norm** — this pattern is acceptable in this codebase; add it to
  a reject-list so future reviews stop flagging it (and the mass-review
  rubric is updated so it never resurfaces).

No file is edited until a class is ruled **fix-in-waves**. Findings in
**ratify-as-norm** classes are closed as by-design.

## How the classes were derived

Every minor finding on a good file was classified by its issue text into one
of the classes below (first-match priority; ordered from most specific to
most general). **`class-distribution.json` in this change dir is now the full
disposition ledger** — all 513 findings serialized, each as `{ id, file,
line, issue, class, disposition }` with a stable id (`g-001`..`g-513`) — not
a 34-example sample. Counts below are recomputed from that ledger after the
council-mandated reclassification (four named misfiles re-homed, then each
class rescanned for other obvious misfits). Numbers are computed from
`review-data.json`, not estimated.

- 513 minor findings across 422 good files.
- 16 named classes cover 449 findings (87.5%); a residual **other** bucket
  holds 64 one-off logic smells (12.5%, 61 files) that resist consolidation
  and are triaged file-by-file (codex: full per-finding triage, never
  "only if a neighbouring class is approved").

## Class table (computed) — with council rulings

Counts recomputed from the full ledger. **Council recommendation (codex)** is
the Codex council's per-class ruling (F = fix-in-waves, R = ratify-as-norm);
**Orchestrator** is the second opinion. Both are advisory — the binding ruling
is Sasha's in `tasks.md §1`. Ratification filters must encode a **narrow
accepted predicate**, never suppress an entire broad class label.

| #   | Class                           | Files | Findings | Council recommendation (codex)                                                                     | Orchestrator                                                           |
| --- | ------------------------------- | ----- | -------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | `comment-archaeology-narration` | 158   | 173      | **F** — remove banned provenance/narration; preserve current-code WHY, not a TODO purge.           | F — agree, but mechanically batchable in one sweep wave (cheap).       |
| 2   | `missing-test-coverage`         | 47    | 49       | **F** — fix behaviorally meaningful, load-bearing gaps; reject ceremonial boundary-test inflation. | Agree with codex.                                                      |
| 3   | `duplication`                   | 39    | 40       | **F** — fix semantic duplication with drift risk, not harmless fixture repetition.                 | Agree with codex.                                                      |
| 4   | `redundant-brittle-test`        | 47    | 51       | **F** — replace vacuous/source-string/CSS-pin tests with behavioral assertions.                    | Agree with codex.                                                      |
| 5   | `magic-values-drift`            | 23    | 24       | **F** — fix derived duplicate constants and unnamed policy limits; no blanket literal sweep.       | Agree with codex.                                                      |
| 6   | `error-handling-robustness`     | 14    | 14       | **F** — observable failure, race, leak, or false-test-confidence gaps.                             | Agree with codex.                                                      |
| 7   | `dead-unreachable-code`         | 14    | 14       | **F** — apply the deletion test; comment-only misfits already moved out.                           | Agree with codex.                                                      |
| 8   | `mutation-immutability`         | 8     | 8        | **F** — prioritize risky filesystem/shared-state mutation over cosmetic rewrites.                  | Agree with codex.                                                      |
| 9   | `misleading-stale-comment`      | 24    | 24       | **F** — wrong documentation is active debt.                                                        | Agree with codex.                                                      |
| 10  | `env-config-silent-fallback`    | 16    | 16       | **F** — enforce boot-time validation; classify unreachable fallback separately.                    | Agree with codex.                                                      |
| 11  | `type-safety-weakening`         | 11    | 11       | **F** — prefer typed builders/`satisfies`; keep only justified boundary casts.                     | Agree with codex.                                                      |
| 12  | `ui-copy-grammar`               | 4     | 4        | **F** — fix user-facing copy and misleading contract names; non-UI findings already reclassified.  | Agree with codex.                                                      |
| 13  | `naming`                        | 6     | 6        | **F** — actively misleading names are cheap to correct; no broad aesthetic renames.                | Agree with codex.                                                      |
| 14  | `query-efficiency-perf`         | 1     | 1        | **R** — bounded, unmeasured micro-optimizations acceptable; extract proven N+1 into a fix class.   | R — agree (ES2024 `Map.groupBy` wave already fixed the measured ones). |
| 15  | `code-structure-placement`      | 10    | 10       | **F** — wrongly attached JSDoc / scattered imports impair tooling; exclude subjective splitting.   | Agree with codex.                                                      |
| 16  | `observability-logging-gap`     | 4     | 4        | **R** — thin query wrappers need no logging; move no-op logger wiring into robustness.             | Agree with codex.                                                      |
| —   | `other` (residual)              | 61    | 64       | **per-finding** — full per-finding triage; "only if a neighbouring class is F" is not defensible.  | Per-finding triage — agree.                                            |

### Two examples per class

Representative pairs (full per-finding text lives in the ledger,
`class-distribution.json`):

- **`comment-archaeology-narration`** — `metrics.registry.test.ts:11` describe-block name embeds change/ticket "37-02"; `otel.bootstrap.ts:2` header opens with phase ref "37-01".
- **`missing-test-coverage`** — `bull-board.guard.test.ts:45` load-bearing 401 branch never exercised; `dlq-monitor.service.test.ts:201` the `used == cap * 0.8` warn boundary is untested.
- **`duplication`** — `email-reminder.processor.test.ts:94` local `EmailReminderJobData` union hand-mirrors the processor's own; `email.service.ts:98` jsonTransport logging block copy-pasted across two methods.
- **`redundant-brittle-test`** — `redis-connection.test.ts:27` poisoned-`process.env` assertion cannot fail; `module-public-api-boundary.test.ts:13` fixture duplicated verbatim then always overwritten, so the committed fixture never runs.
- **`magic-values-drift`** — `dlq-monitor.service.ts:25` `REDIS_MEMORY_WARN_PERCENT (80)` derived-but-not-computed from the `0.8` ratio; `audit-logger-types.ts:79` comment hardcodes "the 26 mutations" count.
- **`error-handling-robustness`** — `worker-observability.test.ts:95` CLS mock `run()` never establishes an async-local scope; `read-through-cache.test.ts:68` Redis-outage read-path guarantee never exercised (fake never rejects).
- **`dead-unreachable-code`** — `project-admin.service.ts:165` pure pass-through query methods fail the deletion test; `period-factory.ts:184` inline comment restates the function docstring (dead prose).
- **`mutation-immutability`** — `module-public-api-boundary.test.ts:39` mutates a git-tracked source file in place; `sentry-trace-correlation.ts:25` reassigns `event.contexts` in place instead of a spread copy.
- **`misleading-stale-comment`** — `trpc-metrics.middleware.test.ts:146` assertion contradicts the adjacent `_sum > 0` comment; `project-activity.router.ts:16` comment references code "above" that is not in the file.
- **`env-config-silent-fallback`** — `pdf-export.processor.ts:106` `PDF_BASE_URL` read via `requireEnv` at job-run time instead of validated at boot; `business-date.ts:205` `periodLengthDays` unvalidated (`length=0` yields end-before-start).
- **`type-safety-weakening`** — `user-activation.router.test.ts:45` `as unknown as` cast bypasses mock type-checking; `analytics.prisma-repository.test.ts:184` fake types `projectId` as `string` where production is `string | null`.
- **`ui-copy-grammar`** — `catalog.procedures.ts:181` `productId` field is a `z.array` yet named singular; `deadline.template.tsx:51` raw ISO timestamp rendered to end users.
- **`naming`** — `bull-board.module.ts:91` used `app` param prefixed `_app` (false unused signal); `reports-my-history-order.test.ts:1` filename claims ordering the file no longer asserts.
- **`query-efficiency-perf`** — `reminder-admin.service.ts:64` `policyExists` loads every policy to `.some()` on the id (list fetched twice).
- **`code-structure-placement`** — `trpc-metrics.middleware.ts:18` JSDoc attached to the wrong interface; `trpc.context.pdf-export.test.ts:418` imports scattered mid-file.
- **`observability-logging-gap`** — `prisma.service.ts:146` shutdown log sequence reads backwards; `carry-over.module.ts:12` service constructed with no logger, so its info log is a production no-op.
- **`other`** — `worker-observability.ts:101` `extractTraceId` accepts a semantically-null traceparent; `env.schema.ts:30` `AUTH_DEV_MODE` coerces any non-`'true'` string to false instead of failing boot.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

<!-- none at proposal time. If Sasha rules any class ratify-as-norm, this
change adds a reject-list entry to the mass-review rubric so the pattern
stops being flagged; that is a tooling/spec update recorded in tasks §3, not
a product-capability change. -->

## Non-goals

- Not fixing anything in this change — implementation is separate, sliced by
  **code seam / file ownership** (not one change per class, since files span
  multiple classes and must be fixed once in their owning seam), and only
  created after §1 rulings.
- Not re-auditing the 1029 files — the finding set is frozen at 2026-07-22.
- Not touching needs-attention files — those are the sibling
  `needs-attention-to-good` campaign.
- Not promoting files to exemplary wholesale — a file reaches exemplary only
  when all its minors are cleared or ratified AND it independently meets the
  hard bar in `docs/exemplary-code-standard.md` (< 250 lines, functions ≤ 50,
  cognitive complexity < 10, zero `let`/mutation, `eslint --max-warnings 0`,
  no exempt entry). This triage removes the review-finding blockers; the
  structural bar is verified per file at fix time.

## Verification

This is a decision-only change: it produces rulings and a disposition ledger,
not code edits. Its completion bar is therefore about the ledger, not a gate.

- The decision artifact (§1) is complete when every one of the 16 classes
  (and a policy for `other`) has a recorded fix / ratify ruling from Sasha.
- **Full-ledger disposition (primary control):** every one of the 513 rows in
  `class-distribution.json` reaches a terminal `disposition` — `ratified`
  (closed as house norm), `fixed` (cleared by a seam-based implementation
  change), or `refuted` (stale / no longer reproduces). No row may stay
  `pending`. The actual fixes land in the separate seam-based implementation
  changes (`tasks.md §2`), each of which passes the full gate + adversarial
  verify at the same bar as the `fix-*` changes.
- **Re-grade sample (additional control only):** after the approved waves
  land, re-review a random sample (≥ 40 files, stratified across the touched
  classes) and confirm the ratified patterns no longer count against a file
  and the fixed ones are gone. The sample is a spot-check on top of the
  full-ledger disposition, not a substitute for it.
- `openspec validate good-to-exemplary-triage --strict`.
