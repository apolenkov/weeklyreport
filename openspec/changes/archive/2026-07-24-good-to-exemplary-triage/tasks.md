# Tasks

Backlog: `class-distribution.json` — the **full disposition ledger** (513
minors, 422 good files, 16 classes + `other`), each row `{ id, file, line,
issue, class, disposition }`. This is a **decision-only** change: it produces
rulings and dispositions, not code edits. Every fix lands in a separate
seam-based implementation change (§2).

## 1. Sasha's per-class rulings (decision gate)

For each class, mark exactly one of **[F] fix-in-waves** or **[R]
ratify-as-norm**. A ratified class gets a reject-list entry (§3) so the
pattern stops being flagged; a fixed class feeds the seam-based
implementation changes (§2). A ratification filter MUST encode a **narrow
accepted predicate**, never suppress an entire broad class label. Counts are
recomputed from `class-distribution.json`; the council recommendation (codex)
and orchestrator second opinion are in `proposal.md`'s class table.

- [x] 1.1 `comment-archaeology-narration` (158 files, 173) — [x] F [ ] R
- [x] 1.2 `missing-test-coverage` (47 files, 49) — [x] F [ ] R
- [x] 1.3 `duplication` (39 files, 40) — [x] F [ ] R
- [x] 1.4 `redundant-brittle-test` (47 files, 51) — [x] F [ ] R
- [x] 1.5 `magic-values-drift` (23 files, 24) — [x] F [ ] R
- [x] 1.6 `error-handling-robustness` (14 files, 14) — [x] F [ ] R
- [x] 1.7 `dead-unreachable-code` (14 files, 14) — [x] F [ ] R
- [x] 1.8 `mutation-immutability` (8 files, 8) — [x] F [ ] R
- [x] 1.9 `misleading-stale-comment` (24 files, 24) — [x] F [ ] R
- [x] 1.10 `env-config-silent-fallback` (16 files, 16) — [x] F [ ] R
- [x] 1.11 `type-safety-weakening` (11 files, 11) — [x] F [ ] R
- [x] 1.12 `ui-copy-grammar` (4 files, 4) — [x] F [ ] R
- [x] 1.13 `naming` (6 files, 6) — [x] F [ ] R
- [x] 1.14 `query-efficiency-perf` (1 file, 1) — [x] F [ ] R
- [x] 1.15 `code-structure-placement` (10 files, 10) — [x] F [ ] R
- [x] 1.16 `observability-logging-gap` (4 files, 4) — [x] F [ ] R
- [x] 1.17 `other` residual (61 files, 64) — **full per-finding triage**
      (codex: the "only triage if a neighbouring class is [F]" policy is not
      defensible and would silently discard genuine one-off defects).
- [x] 1.18 Record each ruling + one-line rationale in this file (git holds
      the decision provenance; no separate doc).
      **Ruling (Sasha, 2026-07-22, via session directive): ALL 16 classes = F
      (fix-in-waves); `other` = full per-finding triage.** Verbatim intent:
      "мне хочется все exemplary! особенно по код стайлу! я люблю строгость и
      бест [practices]" — a blanket strictness ruling. This deliberately
      OVERRIDES the two advisory R recommendations (1.14
      query-efficiency-perf, 1.16 observability-logging-gap — 5 findings
      total): under a blanket-F ruling they are cheap to fix and ratifying
      them would contradict the stated preference for maximum strictness. No
      reject-list entries are therefore needed (§3 becomes a no-op unless a
      finding is refuted against live code).

## 2. Seam-based implementation changes (handoff, not implemented here)

- [x] 2.1 Create the seam-based implementation changes for all **approved**
      findings — sliced by **code seam / file ownership**, NOT one change per
      class. A file appearing under multiple approved classes is fixed **once
      in its owning seam's change**, resolving every one of its approved-class
      findings together. Size each slice by finding count (S ≤ 8 / M ≤ 16 /
      L > 16). Each change re-verifies every finding against live code first
      (findings dated 2026-07-22; some files were also touched by today's
      `fix-*` changes and by `needs-attention-to-good`), then runs the
      `waveb` harness, adversarial verify, and the full gate before commit.
- [x] 2.2 As each seam change lands (or refutes a finding), stamp the
      matching ledger rows' `disposition` (`fixed` / `refuted`) — see §4.

## 3. Ratify-as-norm reject-list (one entry per class ruled [R])

- [x] 3.1 No-op: zero classes ruled [R] under the blanket-F ruling (§1.18).
- [x] 3.2 No-op: no ratified pattern exists to reconcile.
- [x] 3.3 No-op: no rows to stamp `ratified` (final tallies: 507 fixed,
      6 refuted).

## 4. Full-ledger disposition (primary closure control)

- [x] 4.1 **Every one of the 513 ledger rows reaches a terminal
      `disposition`** — `ratified`, `fixed`, or `refuted`. No row may remain
      `pending`. This finding-level ledger — not a file sample — is what
      proves the tail is closed.
- [x] 4.2 **Re-grade sample (additional control only):** DONE 2026-07-24 —
      48-file stratified sample in 3 tranches (8 api / 8 web / 32 mixed),
      per-file sonnet graders + opus distribution audit per tranche. Result:
      41 good / 6 exemplary / 1 needs-attention (product-accordion.tsx —
      self-inflicted silent status fallback, fixed same day). Audits flagged
      9 graded-too-kindly residuals across tranches; all 9 fixed and
      committed (58872c31, bb4c2357, 0cb7fd98). No counter-gaming
      regressions found.
- [x] 4.3 `openspec validate good-to-exemplary-triage --strict` — valid
      (2026-07-23).
- [x] 4.4 Outcome recorded in
      `~/work/customreport-archive/2026-07-24-stage-d-result/RESULT.md`;
      `INDEX.md` updated.
