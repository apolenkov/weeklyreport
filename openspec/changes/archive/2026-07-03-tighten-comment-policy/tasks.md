# Tasks — tighten-comment-policy

## 1. Standard and tooling (this change — policy only, no code edits)

- [x] 1.1 Rewrite `docs/exemplary-code-standard.md` §1.3 to the three-line
      WHY budget + relocation-first wording, AND compress its own rate-limit
      `ipKeyGenerator` exemplar to the ≤3-line form in the same edit (D1 —
      otherwise the doc contradicts its own budget).
- [x] 1.2 Extend the `STANDARD` block and recon prompt in
      `.claude/workflows/exemplary-rollout.js` with the comment-policy
      dimension (budget, relocation-first, app-internal-JSDoc-is-noise) plus
      the `comment-over-budget` / `comment-relocate-to-spec` inventory kinds.
- [x] 1.3 Add the comment-policy review pass to the per-folder done-signal in
      the rollout doc (§3.6) and the whole-repo done definition (§7), noting
      the standing-PR-review gate for post-sweep drift (lint-green ≠
      comment-clean).

## 2. Follow-up change scaffolding (executed AFTER owner veto — not here)

- [ ] 2.1 Create follow-up change `sweep-auth-comments-exemplar`, RE-HOSTING
      the design.md calibration table as its work-list (the per-line owner
      veto lives THERE): preconditions = owner veto pass approved, clean
      `git status` on `apps/api/src/modules/auth` (parallel session), and
      `fix-open-redirect-next-param` ARCHIVED before the open-redirect
      comment (64–71) is compressed (D6/D7).
- [ ] 2.2 In that follow-up: spec cross-check before compression
      (`jwt-session-integrity` for HS256 pin + secret floor;
      `safe-redirect-validation` post-archive incl. backslash/`@` bypasses),
      comment-only diff, security-review pass, gates green, zero non-comment
      changes in the diff.

## 3. Verification

- [x] 3.1 Owner confirm: the POLICY accepted — 3-line budget +
      relocation-first (confirmed by the owner 2026-07-02 morning: «вперед»
      after the explicit budget+relocation explanation). Per-line table
      vetoes belong to the follow-up change, not here.
- [x] 3.2 `openspec validate "tighten-comment-policy" --strict` clean
      (re-run after every review round; last: post-round-4).
- [x] 3.3 Re-audit one already-swept file with the updated
      `exemplary-rollout` recon to confirm the new dimension fires (a planted
      narration comment is reported): confirmed 2026-07-03 — a planted narration
      comment on an otherwise-exemplary auth snippet fires `comment-over-budget`
      while the load-bearing "Logout reuses" WHY is correctly left unflagged.
