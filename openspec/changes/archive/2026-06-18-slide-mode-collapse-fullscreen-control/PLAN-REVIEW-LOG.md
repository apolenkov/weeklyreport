# Plan Review Log: slide-mode-collapse-fullscreen-control

Act 1 (grill-with-docs) complete — locked via grill + Codex blind-spot consult. MAX_ROUNDS=5.

## Round 1 — Codex (via codex-companion runtime)

VERDICT: REVISE. See below; all findings accepted and addressed.
--- change1 findings/fixes ---

1. report-toolbar-layout still listed expand-all/fullscreen separately → added a
   report-toolbar-layout delta re-scoping to the mode-adaptive collapse/fullscreen control.
2. edit label must reflect groupExpanded state → clause 6 + scenario + task: Collapse/Expand by state.
3. content added in-session made the control appear/disappear (row shift) → reserve the slot always
   (render disabled when empty, not removed); design Risk + clause 6 + scenario + task updated.

## Round 2 — Codex: VERDICT APPROVED

All three round-1 findings REFUTED (resolved in the change docs). New non-blocking
note: implementer must update lead-form.test.tsx (queries title="Toggle All") —
already covered by tasks.

## Stop-hook (Codex stop-time) — durable contract conflict, fixed

report-toolbar-parity required `Toggle All` to keep a visible text label, but the
control is now icon-only. Added a report-toolbar-parity delta to this change
removing Toggle All from the keep-labeled set and declaring the mode-adaptive
collapse/fullscreen control icon-only (aria-label + tooltip). Re-validated --strict.
