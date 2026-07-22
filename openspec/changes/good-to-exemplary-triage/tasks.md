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

- [ ] 1.1 `comment-archaeology-narration` (158 files, 173) — [ ] F [ ] R
- [ ] 1.2 `missing-test-coverage` (47 files, 49) — [ ] F [ ] R
- [ ] 1.3 `duplication` (39 files, 40) — [ ] F [ ] R
- [ ] 1.4 `redundant-brittle-test` (47 files, 51) — [ ] F [ ] R
- [ ] 1.5 `magic-values-drift` (23 files, 24) — [ ] F [ ] R
- [ ] 1.6 `error-handling-robustness` (14 files, 14) — [ ] F [ ] R
- [ ] 1.7 `dead-unreachable-code` (14 files, 14) — [ ] F [ ] R
- [ ] 1.8 `mutation-immutability` (8 files, 8) — [ ] F [ ] R
- [ ] 1.9 `misleading-stale-comment` (24 files, 24) — [ ] F [ ] R
- [ ] 1.10 `env-config-silent-fallback` (16 files, 16) — [ ] F [ ] R
- [ ] 1.11 `type-safety-weakening` (11 files, 11) — [ ] F [ ] R
- [ ] 1.12 `ui-copy-grammar` (4 files, 4) — [ ] F [ ] R
- [ ] 1.13 `naming` (6 files, 6) — [ ] F [ ] R
- [ ] 1.14 `query-efficiency-perf` (1 file, 1) — [ ] F [ ] R
- [ ] 1.15 `code-structure-placement` (10 files, 10) — [ ] F [ ] R
- [ ] 1.16 `observability-logging-gap` (4 files, 4) — [ ] F [ ] R
- [ ] 1.17 `other` residual (61 files, 64) — **full per-finding triage**
      (codex: the "only triage if a neighbouring class is [F]" policy is not
      defensible and would silently discard genuine one-off defects).
- [ ] 1.18 Record each ruling + one-line rationale in this file (git holds
      the decision provenance; no separate doc).

## 2. Seam-based implementation changes (handoff, not implemented here)

- [ ] 2.1 Create the seam-based implementation changes for all **approved**
      findings — sliced by **code seam / file ownership**, NOT one change per
      class. A file appearing under multiple approved classes is fixed **once
      in its owning seam's change**, resolving every one of its approved-class
      findings together. Size each slice by finding count (S ≤ 8 / M ≤ 16 /
      L > 16). Each change re-verifies every finding against live code first
      (findings dated 2026-07-22; some files were also touched by today's
      `fix-*` changes and by `needs-attention-to-good`), then runs the
      `waveb` harness, adversarial verify, and the full gate before commit.
- [ ] 2.2 As each seam change lands (or refutes a finding), stamp the
      matching ledger rows' `disposition` (`fixed` / `refuted`) — see §4.

## 3. Ratify-as-norm reject-list (one entry per class ruled [R])

- [ ] 3.1 For each **[R]** class, add a reject-list entry to the mass-review
      rubric (the review harness's finding filter) encoding the **narrow
      accepted predicate** — not a blanket class-label suppression — so the
      house-norm pattern is not re-flagged on the next whole-repo review.
- [ ] 3.2 If a ratified pattern contradicts a rule currently in `CLAUDE.md`
      or `docs/exemplary-code-standard.md`, reconcile it there in the same
      change (either carve the documented exception or drop the rule) — the
      standard and the review must not disagree.
- [ ] 3.3 Stamp every ratified class's ledger rows `disposition: ratified`.

## 4. Full-ledger disposition (primary closure control)

- [ ] 4.1 **Every one of the 513 ledger rows reaches a terminal
      `disposition`** — `ratified`, `fixed`, or `refuted`. No row may remain
      `pending`. This finding-level ledger — not a file sample — is what
      proves the tail is closed.
- [ ] 4.2 **Re-grade sample (additional control only):** after the approved
      waves land, re-review a stratified random sample (≥ 40 files spanning
      the touched classes) with the same Opus-batch + adversarial-verify
      harness as the 2026-07-22 mass review, confirming ratified patterns no
      longer count against a file, fixed findings are gone, and no
      counter-gaming regressions were introduced. The sample sits on top of
      §4.1, never in place of it.
- [ ] 4.3 `openspec validate good-to-exemplary-triage --strict`.
- [ ] 4.4 Record the outcome (classes fixed, classes ratified, disposition
      tallies, files that reached exemplary) in
      `~/work/customreport-archive/` and update its `INDEX.md`.
