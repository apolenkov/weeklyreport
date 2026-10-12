## 1. ReadOnly raise-prefill (C3044)

- [x] 1.1 Reproduce the leak at the public `RisksSection` consumer on baseline
      source: readOnly raise signal, then plain +Add opens with `Blocked`
      pre-selected (focused vitest exits 1 on exactly the new case).
- [x] 1.2 Guard `useRiskRaisePrefill` on `readOnly` (consume signal, skip
      cache/open); new public-consumer regression exits 0 with the fix.
- [x] 1.3 Preserve the readOnly no-dialog contract and one-shot semantics
      (all 13 pre-existing `risks-section` cases still exit 0).

## 2. Locked foreign nudge (C5142)

- [x] 2.1 Reproduce on baseline: stage-less foreign card on a flagged product
      shows the nudge (focused vitest exits 1 on exactly the new case).
- [x] 2.2 Gate `needsStage` on derived `locked`; `LockBadge` disclosure kept.

## 3. Empty product-name labels (C5144)

- [x] 3.1 Reproduce on baseline: `productName` `""`/`"   "` yields no
      `… for Unknown` action names (focused vitest exits 1 on exactly the new
      cases).
- [x] 3.2 Route toggle/edit/delete labels through one trimmed-fallback
      helper; fallback word flagged as owner-refinable in the proposal.

## 4. Scope guard

- [x] 4.1 C3042 hunk reverted to baseline (no real stale-target producer);
      no new test files, no production seams, no main-spec edits.
- [x] 4.2 Focused ESLint + Prettier on changed files exit 0; strict
      `openspec validate` on this change exits 0.
