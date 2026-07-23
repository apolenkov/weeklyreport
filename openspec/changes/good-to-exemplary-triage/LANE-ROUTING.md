# Lane routing — Stage D (good→exemplary), 342 pending findings

The ledger (`class-distribution.json`) is the single dispatch source: every
pending row carries a `lane` field derived from its class per the table below.
`​.claude/scripts/generate-slices.mjs` reads that field when building batches —
routing is never re-decided ad hoc, and a crashed session resumes routing from
git + ledger state alone.

Non-negotiable regardless of lane: a Fable adversarial lens reviews every
slice, and every commit passes through the Fable-run gate. A wrong class label
degrades gracefully — the lens and gate still stand between the edit and main.

## Routing table

| Lane                             | Classes                                                                                                                                                                                   | Pending | Rationale                                                                                                                                                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GROK** (edit-only mechanical)  | misleading-stale-comment 24 · magic-values-drift 25 · dead-unreachable-code 14 · naming 6 · ui-copy-grammar 4                                                                             | **73**  | Proven on the archaeology sweep (173 findings, one pass, scanner-clean). No toolchain; the combined gate catches everything.                                                                                                                      |
| **CODEX** (test/design judgment) | redundant-brittle-test 51 · missing-test-coverage 49 · duplication 41 · env-config-silent-fallback 16 · error-handling-robustness 14 · type-safety-weakening 11 · query-efficiency-perf 1 | **183** | Needs test authorship and refactor judgment; Codex lanes carried wave 1/2 equivalents. Watch for the known deviation mode: characterization tests silently downgraded to post-fix tests (F4/F6) — lens must check.                                |
| **FABLE-TRIAGE-FIRST**           | other 64 · code-structure-placement 10 · mutation-immutability 8 · observability-logging-gap 4                                                                                            | **86**  | Ambiguous by construction ('other' dominates). Fable splits each seam's rows into routable sub-batches (→ GROK or CODEX) before any implementer sees them; rows that survive triage as judgment-heavy stay with CODEX under a hand-written brief. |

## DeepSeek (OpenCode) — pilot lane, not yet routed

- Pilot P12: the 4 `ui-copy-grammar` findings only, ride-along on the next
  GROK mechanical batch. Guardrails: main-shell background Bash, explicit file
  whitelist, `git diff --stat` stray-path check, `grep -nE '[а-яА-Я]'` on every
  touched web file, standard Fable lens + gate. Fallback: re-queue to GROK.
- Promotion ladder P13 (pre-registered, criteria before the run):
  4/4 clean → eligible for `naming`, then `misleading-stale-comment`, one class
  per clean batch. Any lens blocker attributable to the lane → demote back one
  step; two demotions → lane closed for the campaign.
- Hard ceiling, never lifted: no test classes, no `duplication`, no invariant
  surfaces (period dual-state, role-coverage), no `prisma/`, no
  `packages/shared`.

## Refutation parity (P10, standing rule)

A `disposition: refuted` on any cross-module or judgment-class finding may be
stamped into the ledger ONLY after a second-vendor counter-check (Codex or
Grok, read-only, prompt = finding + refutation → concrete failing scenario or
concur). Confirmations already pay for adversarial verification; refutations
pay this. Precedent (2026-07-23, first run of the rule): g-ledger refutation at
`section-slide-readiness.ts:112` overturned → change
`fix-slide-readiness-stale-trafficlight`; the `lead-submit-readiness.ts:189`
refutation stood (spec-enforced, regression-pinned).

## Gate tiers (P2, applied by the generator)

- **fast** — db:generate, typecheck, scoped eslint, unit tests of touched
  workspaces: default for every batch.
- **full** — repo-wide lint + full unit + api integration suite: forced when a
  batch touches non-test files under `apps/api/`, `prisma/`, or
  `packages/shared/`, for every L-tier seam, otherwise every 2–3 batches and
  always before a push cluster.

Red-slice policy (P4): a blocker or lens-death never re-runs the batch — green
siblings commit immediately (targeted per-seam `git add`); the red slice is
remediated, then re-reviewed via `waveb-review-only` scoped to its file list
plus a re-run of only the failed gate steps.

## Pilot log

- 2026-07-23, batch 1 (P12): deepseek-v4-flash-free on g-103/g-105/g-106
  (2 template files). Outcome: all three findings landed and the deadline
  helper matched the spec exactly, but the lane overran its mandate (touched
  the plural noun against instructions) and introduced a JSX whitespace bug
  ("theirsection") — both caught by the orchestrator guardrail diff before
  the lenses. Ladder verdict: NOT 4/4 clean → stays at ui-copy tier, no
  promotion; one more clean run required before `naming`. Paid-tier balance
  still empty; free tier worked.
