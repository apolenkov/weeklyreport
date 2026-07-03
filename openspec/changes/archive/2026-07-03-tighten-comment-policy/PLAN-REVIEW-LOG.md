# Plan Review Log: tighten-comment-policy

Act 1 (grill-with-docs-codex, autonomous mode per owner's mandate) complete —
change authored, strict-valid. Act-1 Codex consult unavailable (rc=137
long-prompt throttle; PONG probe OK); Opus-agent advisor used instead, its
review applied (lean deliverable: focused change + process doc, no mega-v2).
MAX_ROUNDS=5.

## Round 1 — Opus adversary (Codex still detached/pending; degradation noted)

VERDICT: REVISE. Blocking: (1) open-redirect relocation target lives in the
UNARCHIVED fix-open-redirect-next-param (not specs/) — pointer would dangle;
(2) D1's "lazy-env note" anchor doesn't exist in the auth files (real
in-budget keep is auth.controller.ts:68-69); (3) the 3-line budget contradicts
the standard's own 5-line rate-limit ipKeyGenerator "keep" exemplar. Medium:
(4) split the auth exemplar sweep out (auth folder dirty under a parallel
session; policy shouldn't couple to it); (5) web-sync note (40-41) guards a
LIVE divergence (viewer redirect) — keep until the map dedups; (6) post-sweep
drift ungated (recon only fires at sweep time). Minor: (7) security-path list
closed; (8) HS256 coordination-note deletion under-justified as written.
Verified-good: no header collisions; calibration line numbers accurate;
jwt-session-integrity covers HS256+floor; validate --strict clean.

### Claude's response

Accepted all 8. (1)→ new D6 durable-home rule + ordering (archive
fix-open-redirect-next-param first; comment stays until then). (2)→ D1
re-anchored on auth.controller.ts:68-69. (3)→ task 1.1 now compresses the
rate-limit exemplar in the same doc edit. (4)→ new D7: exemplar sweep split
into follow-up change sweep-auth-comments-exemplar; this change is
policy-only. (5)→ table row: web-sync note KEPT compressed until dedup. (6)→
requirement 4 extended + new post-sweep-PR scenario. (7)→ "including but not
limited to" + CSRF/secrets/authz added. (8)→ table row labels the coordination
note archaeology-of-archived-change with jwt-session-integrity as surviving
home. Re-validated --strict: clean.

## Round 2 — Opus adversary

VERDICT: REVISE. All 8 round-1 findings confirmed fixed; the normative spec
delta judged approval-quality. Remaining seams from the split, all in
non-normative docs: (M1) task 3.1 + Open Questions still gated THIS change on
the per-line calibration-table veto that belongs to the follow-up sweep; (m2)
Why/Context still listed safe-redirect-validation as "already durably in
specs", contradicting D6; (m3) Non-Goals said "no code edits at all" while
task 1.2 edits the rollout workflow script. Realism note: "standing PR
review" must not imply an automated gate (CI is manual; hooks only).

### Claude's response

Accepted all. (M1)→ table relabeled EVIDENCE + re-hosted by follow-up (task
2.1); task 3.1 + Open Questions narrowed to budget+policy confirm. (m2)→
Why/Context reworded: jwt-session-integrity durable today; safe-redirect
in-flight, durable at archive. (m3)→ "no product/src code edits". Realism →
NB added to the risk entry (reviewer/agent diligence, no automated gate).
Codex round-1 job terminated with an empty verdict (3rd throttle-hang) —
Opus adversary confirmed as the Act-2 critic. Re-validated --strict.

## Round 3 — Opus adversary

VERDICT: REVISE (single item). All round-2 fixes confirmed; sole defect: the
formatter had split "budget + policy" in the design Status block into a stray
one-item bullet, making the line read "gates only on the budget" —
contradicting task 3.1 in the exact block the owner reads first. (validate
--strict does not parse design prose, so it could not catch this.)

### Claude's response

Rejoined as "budget-and-policy confirm (task 3.1)" — worded without "+" so
prettier cannot re-promote it to a bullet; verified post-formatter; --strict
clean.

## Round 4 — Opus adversary

VERDICT: APPROVED. Round-3 line confirmed fixed; stray-marker scan clean;
spec delta untouched; --strict clean. Converged in 4 rounds (cap 5). Codex
CLI was throttled all night (3 hangs, 0 bytes) — the Act-2 critic was a fresh
Opus adversary agent, per the logged degradation; NOT a cross-model review.

## Post-approval note — Codex unavailable (final)

Codex second-opinion attempts: 4 (night ×3, morning 09:07) — all rc=137 with
zero bytes streamed; `codex doctor` fully green (websocket 101, auth OK) =
ChatGPT-plan quota exhaustion, not a config/plugin issue. Closing: this change
was adversarially reviewed by the Opus agent only. Re-run Codex manually when
the ChatGPT window resets if a cross-model pass is still wanted.
