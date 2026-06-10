# Tasks — Unify Risk Severity and Stage Status

Decisions D1-D4: `design.md`. DEPENDS ON `require-risk-stage` (lands
first tonight — risks always carry ≥1 stage). Regression-heavy area:
read each existing test suite BEFORE touching its subject.

## 0. Pre-read (contract intake)

- [ ] 0.1 Read `use-status-risk-sync.test.tsx`,
      `use-status-risk-coupling.test.ts`,
      `lead-form-sync-bridge.test.tsx`, `lead-form.test.ts`
      (mapper) and list which pinned behaviors the new contract keeps
      vs replaces; note it in this file before editing code.

## 1. Severity floor (D1)

- [ ] 1.1 `lib/mappers/lead-form.ts`: `mapLeadProducts` passes
      covering risks (NOT items) into `buildStageGrid` /
      `deriveEffectiveStageStatus`; replace the PRJ-2 comment with a
      supersession note pointing at this change.
- [ ] 1.2 Apply the same render-time floor to the live form state
      (bridge or `lead-form.tsx` memo) via a shared pure helper.
- [ ] 1.3 Tests: mapper floor (stale persisted on-track + covering
      risk → at-risk; blocked beats at-risk), items still
      disconnected; update `lead-form.test.ts:197` area to the new
      contract.

## 2. Raise interception → prefilled dialog (D2)

- [ ] 2.1 Interception in `handleStageStatusChange` (or bridge
      wrapper): at-risk/blocked with no covering risk of sufficient
      severity → do not apply; emit prefill request
      `{ productId, stageIds: [stage], severity }`.
- [ ] 2.2 Extend the `risksAddSignal` channel to carry the optional
      prefill payload; `RisksSection` opens `RiskEditDialog` in create
      mode with it (coordinate with `fix-section-add-signal-reset` /
      `refactor-lead-dialog-lifecycle` if already landed).
- [ ] 2.3 On dialog save: create risk, then set the explicit chip
      status through the auto-sync source (loop guard preserved). On
      cancel: no-op (status was never applied).
- [ ] 2.4 Tests: interception (no risk → dialog, status unapplied),
      save path (risk created + chip raised, no sync loop), cancel
      path (chip unchanged, no row).

## 3. Lower interception → confirmed removal (D3)

- [ ] 3.1 Interception for on-track/empty on a covered chip: compute
      covering own risks; cross-author covering risk present → block
      with explanatory message (English copy), no dialog.
- [ ] 3.2 Confirmation via `ConfirmDeleteDialog`: copy enumerates
      deletions and stage-strips; on confirm delete single-stage
      covering risks, strip the stage from multi-stage ones, then
      apply the chip status; on cancel no-op.
- [ ] 3.3 Tests: single-stage delete, multi-stage strip (sibling chip
      keeps its floor), cancel no-op, cross-author block.

## 4. Retire the suggestion flow (D4)

- [ ] 4.1 Remove `handleRiskFilled` suggestion path +
      `requestStatusUpdateConfirmation` consumer wiring; keep
      `SyncSource` guard for the D2 auto-apply.
- [ ] 4.2 Replace suggestion tests in `use-status-risk-sync.test.tsx`
      with floor/interception tests pinning strictly more behavior;
      keep `computeCoupling`/`computeUnbackedStages` tests (banner
      stays for residual legacy data).

## 5. Verification

- [ ] 5.1 `grep -nE '[а-яА-Я]'` over changed
      `apps/web/src/**/*.tsx` — every match is data/comment/test.
- [ ] 5.2 Gates: `pnpm typecheck && pnpm lint && pnpm test &&
    pnpm build` — record results here.
- [ ] 5.3 Live walk on :3000 (lead role): raise-without-risk →
      dialog; cancel → unchanged; save → chip floored; lower →
      confirm → risk gone; head review + export show the same
      statuses. Re-check on FRESH seed data, not only the worked
      draft.
