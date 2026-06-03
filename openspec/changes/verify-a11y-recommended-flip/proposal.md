# Verify the a11y Behavior Changes from the Biome Recommended Flip

> **Coordination (see `docs/openspec-roadmap.md`):** the per-role runtime sweep
> here is NOT a separate harness. It is run through the swappable **Driver** built
> in `behavioral-ui-regression-gate` (the single sweep engine). Convert this
> change's high-priority a11y catalog entries into Driver scenarios; do not stand
> up a parallel Playwright sweep.

## Why

The `enable-biome-recommended-ruleset` flip (merged to `main`, commit
`80dcef5d`) cleared 133 recommended-ruleset errors. Most were mechanical, but
the behavior commit (`c4610797`) altered interactive behavior that the static
gates (`typecheck`, `lint`, `test`, `build`) cannot prove correct:

- **Keyboard navigation** added to the status-slide deck region
  (`status-slide-deck.tsx`: role/tabIndex + `onKeyDown`).
- **A real Escape handler** added to a delete dialog in `periods-tab.tsx` that
  previously lacked one; interactive semantics + tabindex changes in
  `lock-badge.tsx`, `users-tab.tsx`.
- **~13 dialog-backdrop `biome-ignore` suppressions** whose justification makes
  a load-bearing accessibility _claim_ — "the dialog is keyboard-closable via
  Escape + a Cancel/close button." A code spot-check confirmed Escape handlers
  exist in three sampled dialogs, but no runtime per-role pass exercised them.

Gates are green and the suppressions were not silenced blindly, but
linter-zero is not the same as a working interaction. This change records and
tracks the runtime verification debt so it is not lost behind the green gate.

## What Changes

- **`design.md` carries the full regression-test catalog** — 480 tests across
  58 changed files, derived by logic from each file's diff at the granularity
  of file → code block → DOM-model assertion → interaction (418 unit-rtl, 56
  snapshot, 6 playwright-e2e; 266 high-priority). This is the durable
  description of what regression coverage is _possible_ for the flip's a11y
  delta.
- The verification itself (this change's acceptance): run the high-priority
  catalog entries + the per-role runtime sweep below, confirm the behavior
  changes work and regress nothing.
- If a check finds a real defect, fix it under a follow-up change — do not patch
  under this acceptance-only change (mirrors `final-gates-resweep` FGR-X2).

## Impact

- Affected commits to verify: `c4610797` (behavior) on top of `80dcef5d` (flip).
- Affected screens: lead report form (slide deck, edit dialogs), admin
  periods/users/products/groups tabs (dialogs), report-shell lock badge.
- Risk: low to land (verification only); the risk it guards is a silently
  broken keyboard interaction or a backdrop suppression masking an
  inaccessible dialog.

## Non-goals

- **Re-running the static gates.** Those are green and proven; this is the
  runtime axis only.
- **The full final-gates-resweep per-role console sweep** (FGR-S1..S5). That is
  a separate, parent-blocked change; this one is scoped to the Biome-flip a11y
  behavior delta, not the whole acceptance bar.
- **New durable a11y requirements.** Recording the verification, not adding a
  spec contract.
