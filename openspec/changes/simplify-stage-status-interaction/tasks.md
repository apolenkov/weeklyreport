# Tasks

## 1. Chip becomes a toggle (D1)

- [x] 1.1 Delete `stage-chip-menu.tsx`. `StageChip` renders no popover; an
      editable, uncovered chip click toggles empty ⇄ on-track off the RAW status.
- [x] 1.2 A risk-floored chip is not directly editable — clicking shows the
      "resolve the covering risk/blocker first" style inline hint, no mutation.
- [x] 1.3 Remove the `riskGap` prop chain: `sdlc-pipeline.tsx` `riskGapForStage`,
      `StageChipProps.riskGap`, and the bridge's `riskGapForStage` builder.
- [x] 1.4 Update the chip aria/tooltip suffix: "status set" applies only to On
      Track; at-risk/blocked always read "by risk" (no explicit-severity path).

## 2. Remove chip-driven risk flows (D2)

- [x] 2.1 `lead-form-sync-bridge.tsx`: collapse `handleStageStatusChange` to the
      toggle + covered-chip hint; delete the D2 raise-interception (`setRiskPrefill`
      from a chip) and the D3 `pendingLower`/`confirmLower` confirmation.
- [x] 2.2 Delete the three dead toasts (`BLOCKED_FLOOR_LOWER_MESSAGE`,
      `CROSS_AUTHOR_LOWER_BLOCKED_MESSAGE`, unbacked-raise route) and any now-unused
      helpers (`describeLowerEffects`; `removeStageFromCoveringRisks` only if the
      risk-card path doesn't reuse it).

## 3. Orphan-severity render collapse (D3, council find C)

- [x] 3.1 `applyRiskSeverityFloor`: drop the `covering.length === 0` early return;
      route every own stage through `deriveEffectiveStageStatus(stage.status,
covering, [])` so orphan explicit severities collapse to On Track on the
      live form, matching `buildStageGrid`.
- [x] 3.2 Test: a stage persisted blocked with no covering risk renders On Track
      on the live form (parity with the read model).

## 4. Grey-stage submit promotion (D4)

- [x] 4.1 `handleConfirmSubmit`: map unset own stage statuses to On Track in the
      submit payload (mirror the null→green project/activity coercion).
- [x] 4.2 `showSubmitConfirm` dialog: add the "N stage(s) not set — marked On
      Track" line (omit at 0); non-blocking.
- [x] 4.3 Tests: warning count; promotion on confirm; no warning at 0.

## 5. Risk-card severity toggle (D5)

- [x] 5.1 `risk-card.tsx`: a compact blocked↔at-risk toggle beside Edit that
      flips `severity` without opening the full dialog.
- [x] 5.2 Test: the toggle flips severity and calls the change handler.

## 6. Unship the P4 menu-hint work + test sweep

- [x] 6.1 Delete the "→ create risk" menu-hint tests in `stage-chip.test.tsx`
      and the D2/D3 flow tests in `lead-form-sync-bridge.test.tsx` /
      `sdlc-pipeline.test.tsx` that assert the removed behavior; add toggle +
      collapse + submit-coercion coverage.
- [x] 6.2 Sweep `e2e/catalog/*` and the ai-driver oracle catalogs for chip-menu
      / "→ create risk" / lower-confirm assumptions; update or note.

## 7. Verify

- [x] 7.1 Full gates green (db:generate → typecheck → lint → unit).
- [x] 7.2 Live-verify on :3000 per design.md Verify section.
