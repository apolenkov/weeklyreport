# Plan Review Log: dependency-currency-pnpm-and-majors

Act 1 (grill-with-docs) complete — plan locked, deliverable authored + `openspec validate --strict` PASS.
Act 2 reviewer: **Opus** (Codex rate-limited until ~19:00, user redirected Act 2 to Opus). MAX_ROUNDS=3.

## Round 1 — Opus reviewer

VERDICT: REVISE. Findings:

1. (BLOCKING) `@types/nodemailer@^8` stranded by nodemailer 8→9; conflicts with surviving types/stub spec requirements.
2. (BLOCKING) `@react-email/render` removal rests on an unverified re-export claim.
3. bull-board "no breaking changes" contradicts "migrate to v8 import paths" (subpath import `@bull-board/api/bullMQAdapter`).
4. Supersession named only @bull-board + react-email; nodemailer + unicorn are also bundled majors vs the surviving "Minor And Patch" isolation rule.
5. (minor) `^9.0.1` asserted as fact without hedge.

### Claude's response (final arbiter)

- F1 accepted, resolution corrected by evidence: `@types/nodemailer@9` does NOT exist (latest 8.0.1, not deprecated) and nodemailer@9 ships no types → KEEP `@types/nodemailer@^8.0.1`, typecheck-verify, record the types-major lag (main spec allows a recorded justification). Added spec scenario + proposal/design/tasks lines.
- F2 accepted: the claim was in fact verified (`export * from "@react-email/render"`, index.d.mts:7), but made the re-confirm an explicit Task 3.1 step and recorded the evidence in design.
- F3 accepted: reframed to "no behavioral break ≠ no API change"; verify v8 subpath import surface (task 2.3, proposal, design).
- F4 accepted: widened the supersession statement to name all four bundled majors + the surviving Minor/Patch rule.
- F5 accepted: hedged the version wording in design ("re-confirm at implementation"); spec keeps the "at this change" convention used by sibling requirements.
- Re-validated `--strict`: PASS.

## Round 2 — Opus reviewer

VERDICT: APPROVED. All five prior findings verified resolved against the files; no new defects introduced. npm-verified `@types/nodemailer@8.0.1` is the latest 8.x (pin satisfiable) and no 9.x exists. Headers still match the main spec verbatim. Lone non-blocking nit: "keep the current stub" nudges the floor `^8.0.0`→`^8.0.1` (8.0.1 is the maintained 8.x tip — correct, caret already permits it).

## Resolution — APPROVED (converged, 2 rounds)

Act 2 run by **Opus** at the user's direction (Codex rate-limited until ~19:00). Final arbiter (Claude) accepts APPROVED. No code written — implementation awaits explicit user go-ahead.
