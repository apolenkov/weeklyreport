# Needs-Attention → Good

## Why

The 2026-07-22 mass review (Opus batch review + adversarial verification,
council-ratified — `~/work/customreport-archive/2026-07-22-mass-review/`,
`review-data.json`) graded all 1255 source files. 125 landed at
**needs-attention**. The confirmed **major** findings on those files are
already carved into the seven `fix-*` / `harden-*` changes committed today
(period reopen leak, Fill From TOCTOU, archive floor, portfolio snapshot,
admin restore, web product-code defects, test-suite hardening) — 38 majors
across 13 files whose only findings are majors are therefore **out of scope
here**.

What remains is the **minor / structure tail**: 215 minor findings spread
across the other **112** needs-attention files. Each is individually small
(a banned change-slug comment prefix, an untested branch, a hand-mirrored
constant, a vacuous assertion, a naming mismatch) but together they are the
reason these 112 files sit below the "good" bar. This change is the umbrella
campaign that clears that tail file-by-file so every needs-attention file
either reaches **good** or has its residual finding explicitly re-graded as
a non-issue.

This is a **tail-clearing campaign**, not a fresh audit. It exists so future
sessions implement in waves without re-discovering the backlog.

## Campaign frame

- **Harness.** Run through the `waveb-*` autorun/batch harness one slice at a
  time (see the wave plan in `tasks.md`). Seam-disjoint slices may batch in
  parallel; a slice touching shared tooling runs solo.
- **Re-verify before acting.** Every finding is dated **2026-07-22** against
  `main` at the review SHA. Before touching a file, re-read the current code
  and confirm the finding still holds — several of these files were also
  edited by today's seven `fix-*` changes, so a finding may already be moot.
  A finding that no longer reproduces is recorded as **re-graded (stale)**,
  not "fixed".
- **Adversarial verify.** Each slice's edits pass two adversarial verifier
  lenses + the full gate (`db:generate`, `typecheck`, `lint`, `test`) before
  commit, exactly as the seven `fix-*` changes did. The bar is the same:
  no counter-gaming splits, no comment churn that trades one archaeology
  prefix for another.
- **Source of truth.** The machine-readable backlog is
  `files-seed.json` in this change dir: `[{ file, verdict, findings:[{
severity, line, issue }] }]` for all 112 files, **minors only**. `line`
  numbers are as-of the review SHA and must be re-resolved against live code.

## Scope

- **In:** the 215 minor findings on the 112 needs-attention files that carry
  at least one minor.
- **Out:** the 38 major findings (owned by the seven sibling `fix-*` /
  `harden-*` changes); the 13 needs-attention files whose only findings are
  majors; every file already graded good/exemplary.

## Scoreboard (computed from `review-data.json`)

125 needs-attention files → 13 majors-only (excluded) → **112 files, 215
minors** grouped by slice:

| Slice                        | Files | Minors | Size |
| ---------------------------- | ----- | ------ | ---- |
| web-landing-org-period       | 11    | 24     | L    |
| web-report-pages             | 9     | 21     | L    |
| api-infrastructure           | 9     | 19     | L    |
| web-shared                   | 9     | 19     | L    |
| web-report-sections          | 8     | 14     | M    |
| e2e                          | 6     | 13     | M    |
| api-period-carryover-archive | 6     | 12     | M    |
| web-lib                      | 8     | 11     | M    |
| web-app                      | 5     | 10     | M    |
| api-auth-admin               | 5     | 9      | M    |
| prisma                       | 3     | 8      | S    |
| packages-misc                | 5     | 7      | S    |
| web-admin                    | 4     | 7      | S    |
| api-comms                    | 3     | 7      | S    |
| api-lib                      | 4     | 6      | S    |
| api-report-pub-search        | 3     | 6      | S    |
| api-sections-review          | 2     | 4      | S    |
| api-modules-other            | 2     | 4      | S    |
| web-dashboard                | 2     | 4      | S    |
| api-analytics-activity-obs   | 3     | 3      | S    |
| web-review                   | 2     | 3      | S    |
| web-slides                   | 2     | 2      | S    |
| web-viewer-telemetry         | 1     | 2      | S    |
| **TOTAL**                    | 112   | 215    |      |

Size = minor-count bucket (S ≤ 8, M ≤ 16, L > 16), the wave-sequencing hint.

## What Changes

Per slice, per file: apply the minor fix (or record a stale re-grade), then
re-run the file's scoped unit suite. The per-file, per-finding checklist is
in `tasks.md`; the exact issue text and review-SHA line for every finding is
in `files-seed.json`. No product-behavior change beyond what a minor finding
literally names — this campaign does not reopen the majors' design decisions.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

<!-- none — this is a code-quality tail campaign; the exemplary-code bar it
enforces already lives in `docs/exemplary-code-standard.md` and the
`lint-max-strictness-standard` spec. No query semantics change. -->

## Non-goals

- Not re-auditing any file — the finding set is frozen at the 2026-07-22
  review; this change only clears it.
- Not touching the 38 majors or their sibling `fix-*` changes.
- Not promoting anything to **exemplary** — that is the separate
  `good-to-exemplary-triage` campaign over the 1029 good files. This change's
  ceiling is **good**.

## Verification

- Per slice: the scoped unit suites for every touched file, then the full
  gate (`pnpm --filter @customreport/api db:generate && pnpm typecheck &&
pnpm lint && pnpm test`); e2e slice additionally runs
  `pnpm test:e2e:integration`.
- **Final control re-grade:** re-review all **125** needs-attention files
  (not only the 112 with minors — the 13 majors-only files confirm their
  sibling `fix-*` change landed) against live code and confirm each is now
  **good** or has a recorded, justified re-grade. Nothing may still read
  needs-attention on a minor this campaign owns.
- `openspec validate needs-attention-to-good --strict`

## Sequencing

The seven `fix-*` / `harden-*` changes (wave 1) **MUST land before this
campaign starts** — a correctness prerequisite, not a preference. Known file
overlap means starting first would fix a line a major fix then rewrites (or
re-flag a finding it already resolved); see `tasks.md §0.0`. Once wave 1 is
on `main`, slices here are mutually seam-disjoint enough to batch S-tier ones
in parallel.
