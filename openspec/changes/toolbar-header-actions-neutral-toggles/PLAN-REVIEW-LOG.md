# Plan Review Log: toolbar-header-actions-neutral-toggles

Started session 2026-06-18. MAX_ROUNDS=5.

## Round 1 — Codex UNAVAILABLE (corp-proxy hang)

Two attempts to run `codex exec -s read-only` both hung at 0% CPU behind
`HTTP_PROXY=127.0.0.1:1100`: attempt 1 ran 25 min with no `thread.started` and a
0-byte verdict; attempt 2 was watchdog-killed at 200s, same symptom (no session,
0-byte verdict). This matches the known "codex hangs on corp proxy" failure mode.
Cross-model plan review fell back to the advisor (stronger reviewer model) in
place of Codex for this session.

## Round 1 (substitute) — Advisor review

Design judged sound: header-line actions resolve the row-height mismatch; the
neutral toggle family matches the user's "green = action / toggle = view" model;
the `--color-surface` fix is grounded in a verified grep (token undefined).

One real gap found (the kind Codex would catch): existing toolbar specs not in
the original delta set carried stale prose referencing the deleted two-row
structure ("the two-row layout moves the lead actions into the document-action
row", "page header row or document-action toolbar row"). Left unfixed this blocks
a clean archive (cf. openspec-archive-spec-debt).

### Claude's response

Added MODIFIED deltas to re-scope the stale prose to "page header line /
context-control bar":

- head-toolbar-semantics: "Deferred placeholders render visually subordinate"
  and "The word Publish appears on exactly one head control".
- report-toolbar-parity (new delta file): "Labeled header actions are not
  icon-ified by parity work".
  Re-validated `--strict`: clean. Review loop stopped after one substitute pass
  (advisor guidance: design is sound, do not manufacture more rounds).

## Round 1 — Codex (via codex-companion runtime; raw `codex exec` hangs on proxy)

VERDICT: REVISE. Two blocking findings, both accepted:

1. Task 3.1's grep scope ("across apps/web/src + packages/ui") was broader than
   the requirement, which only covers the toggles; `--color-surface` is also read
   at weekly-report-page.tsx:545 (a separate undefined-token issue).
2. proposal.md listed report-toolbar-parity under "honours without modifying"
   while a MODIFIED delta for it exists — contradiction.

### Claude's response

1. Narrowed task 3.1 to the report-shell segmented toggles; added an Out-of-scope
   note that other `--color-surface` callsites are a separate token-hygiene task.
2. Moved report-toolbar-parity into the MODIFIED list in proposal.md and removed
   it from "honours without modifying".
   Re-validated --strict: clean. Re-submitting to the same Codex session for round 2.

## Round 2 — Codex

VERDICT: APPROVED. Both round-1 findings confirmed resolved (task 3.1 narrowed to
the three report-shell toggles + out-of-scope documented; report-toolbar-parity
moved into the MODIFIED list so the proposal's affected-specs set matches the
actual deltas). No new material findings. Plan-review loop converged in 2 rounds.
