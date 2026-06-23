# Plan Review Log: code-health-audit-map

Act 1 (grill-with-docs) complete — change locked, decisions recorded in
design.md. CONTEXT.md/ADRs unchanged (no domain-language conflict surfaced).
MAX_ROUNDS=5.

## Act 2 — blocked (Codex quota)

Round 1 could not run: `codex exec` returns "You've hit your usage limit …
try again at Jun 25th, 2026" (probed 2026-06-22, codex-cli 0.141.0, model
gpt-5.5). This is a quota block, not a hang. Act-2 adversarial review is
deferred until the Codex quota resets (Jun 25) or a substitute reviewer is used.

Note: Codex already adversarially questioned this change during Act 1 (15
gap/blind-spot questions, thread 019eefe3-7b39-72c2-9c1b-320382b07c5e); all were
folded into design.md before locking.

## Round 1 — Internal skeptic (Opus, Codex substitute)

Codex quota-blocked, so a strong read-only Opus skeptic stood in (NOT
cross-model). VERDICT: REVISE. 10 findings; arbiter dispositions below.

ACCEPTED (fix applied):

1. No MODIFIED block → merged spec self-contradicts (stale inline numbers in the
   4 legacy requirements vs new "every claim traces + stamped"). → scope the
   discipline to the register + MODIFY the lead-form requirement to defer its
   LOC to the register.
2. Hotspot normalization set-relative → not reproducible. → use absolute pinned
   divisors (code_LOC/300, peak_cc/15), not min-max over the set.
3. Verdict vocabulary fits only lead-form, not the 3 architectural targets. →
   ADD a requirement for architectural targets with dimension-appropriate
   evidence + a PRESENT/RESOLVED verdict; backs task 3.2.
4. "Code: none" false — knip/jscpd/ts-prune not installed. → descope the
   tooling-dependent dead-code/duplication MEASUREMENT to a named follow-up;
   this change uses only already-present tools and is truly code-none.
5. Churn command rename-blind. → add `--follow`.
6. Binary verdict misses "exemption now unnecessary". → add third verdict
   OBSOLETE (remove the exemption line).
7. sonarjs/no-nested-functions per-file exemptions left out of scope. → broaden
   re-attestation to EVERY per-file lint exemption.
8. threshold-1 cognitive-complexity trick under-specified. → pin the exact
   working invocation (repo-root config, tseslint.parser, jsx) in design.
9. Non-authorization guardrail prose-only. → add explicit "no batch/parallel
   execution" line + per-entry DoD separation.
10. Simpler alternative = descope dead-code/dup tooling (same as #4). → adopted.

### Claude's response (round 1 fixes)

All 10 findings applied: MODIFIED lead-form requirement; absolute pinned
divisors; architectural-targets requirement (STILL-PRESENT/RESOLVED); descoped
knip/jscpd (Code: none true); churn `--follow`; OBSOLETE verdict; broadened
re-attestation to every per-file exemption (incl. no-nested-functions); pinned
threshold-1 invocation; no-batch/no-parallel guardrail. `validate --strict` green.

## Round 2 — Internal skeptic (Opus, resumed)

VERDICT: APPROVED. All 10 prior findings confirmed resolved; MODIFIED header
exact-matches the live requirement; the threshold-1 trick matches what the
reviewer verified empirically. 3 NEW minor non-blocking doc-staleness nits
raised (overpromising "named follow-up"; stale design.md decision-log lines;
design non-authorization section lagging the spec).

### Claude's response (round 2 fixes)

All 3 nits fixed: "named follow-up" → "dedicated follow-up (to be created)" in
spec/proposal/tasks; design.md decision-log updated for OBSOLETE +
STILL-PRESENT/RESOLVED + absolute divisors + deferred dimensions; design
non-authorization section now states the no-batch/no-parallel mandate.

## Resolution: APPROVED (Act 2 via Opus skeptic, Codex quota-blocked)

Converged in 2 rounds. Deliverable ready for the apply flow. No code written.
