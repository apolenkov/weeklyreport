# Tasks — Unify Risk Severity and Stage Status

Decisions D1-D4: `design.md`. DEPENDS ON `require-risk-stage` (lands
first tonight — risks always carry ≥1 stage). Regression-heavy area:
read each existing test suite BEFORE touching its subject.

## 0. Pre-read (contract intake)

- [x] 0.1 Read `use-status-risk-sync.test.tsx`,
      `use-status-risk-coupling.test.ts`,
      `lead-form-sync-bridge.test.tsx`, `lead-form.test.ts`
      (mapper) and list which pinned behaviors the new contract keeps
      vs replaces; note it in this file before editing code.

Intake note (2026-06-11):

- `use-status-risk-coupling.test.ts` — KEEP unchanged
  (`computeCoupling`/`validateCoupling` stay; banner remains for
  legacy data).
- `use-status-risk-sync.test.tsx` — Tests 1/2/5/7 (chip apply, no
  risk auto-add/auto-delete at hook level, auto-sync apply) KEEP;
  Tests 3/4/6 (handleRiskFilled suggestion + its loop guard)
  REPLACED — suggestion flow removed (D4); interception/floor
  tests land in `lead-form-sync-bridge.test.tsx` where the new
  behavior lives. Hook args shrink to `{ onProductsChange }`.
- `lead-form-sync-bridge.test.tsx` — Tests 1/3/4,
  `promoteStageStatus`, up-flow promotion KEEP. Test 2 (chip
  on-track→at-risk applies directly) REPLACED by D2 interception
  (dialog opens, status unapplied). Test 5 (chip-level "Clear"
  confirm, "1 linked risk… will stay") REPLACED by the D3
  bridge-level confirmed-removal dialog; the dev/Dev stageIds
  canonicalization it pinned is preserved in the new test.
- `lead-form.test.ts` (mapper) — PRJ-2 test ("linked risks do NOT
  override explicit chip status") REPLACED by floor tests
  (D1 supersedes PRJ-2); cross-project isolation test KEEP (now
  meaningful — risks are actually passed again); all other
  mapper tests KEEP.
- Interception lives in the BRIDGE wrapper (task 2.1 option b):
  the hook stays a dumb applier; `applyStatusSuggestion` (the
  auto-sync source) bypasses interception by construction.
- Chip-level `pendingClear` confirm in `stage-chip.tsx` +
  `linkedRiskCount` plumbing in `sdlc-pipeline.tsx` are
  superseded by D3 (otherwise double dialogs on Clear) — removed
  as orphans of this change.

## 1. Severity floor (D1)

- [x] 1.1 `lib/mappers/lead-form.ts`: `mapLeadProducts` passes
      covering risks (NOT items) into `buildStageGrid` /
      `deriveEffectiveStageStatus`; replace the PRJ-2 comment with a
      supersession note pointing at this change.
- [x] 1.2 Apply the same render-time floor to the live form state
      (bridge or `lead-form.tsx` memo) via a shared pure helper.
- [x] 1.3 Tests: mapper floor (stale persisted on-track + covering
      risk → at-risk; blocked beats at-risk), items still
      disconnected; update `lead-form.test.ts:197` area to the new
      contract.

## 2. Raise interception → prefilled dialog (D2)

- [x] 2.1 Interception in `handleStageStatusChange` (or bridge
      wrapper): at-risk/blocked with no covering risk of sufficient
      severity → do not apply; emit prefill request
      `{ productId, stageIds: [stage], severity }`.
- [x] 2.2 Extend the `risksAddSignal` channel to carry the optional
      prefill payload; `RisksSection` opens `RiskEditDialog` in create
      mode with it (coordinate with `fix-section-add-signal-reset` /
      `refactor-lead-dialog-lifecycle` if already landed).
- [x] 2.3 On dialog save: create risk, then set the explicit chip
      status through the auto-sync source (loop guard preserved). On
      cancel: no-op (status was never applied).
- [x] 2.4 Tests: interception (no risk → dialog, status unapplied),
      save path (risk created + chip raised, no sync loop), cancel
      path (chip unchanged, no row).

## 3. Lower interception → confirmed removal (D3)

- [x] 3.1 Interception for on-track/empty on a covered chip: compute
      covering own risks; cross-author covering risk present → block
      with explanatory message (English copy), no dialog.
- [x] 3.2 Confirmation via `ConfirmDeleteDialog`: copy enumerates
      deletions and stage-strips; on confirm delete single-stage
      covering risks, strip the stage from multi-stage ones, then
      apply the chip status; on cancel no-op.
- [x] 3.3 Tests: single-stage delete, multi-stage strip (sibling chip
      keeps its floor), cancel no-op, cross-author block.

## 4. Retire the suggestion flow (D4)

- [x] 4.1 Remove `handleRiskFilled` suggestion path +
      `requestStatusUpdateConfirmation` consumer wiring; keep
      `SyncSource` guard for the D2 auto-apply.
- [x] 4.2 Replace suggestion tests in `use-status-risk-sync.test.tsx`
      with floor/interception tests pinning strictly more behavior;
      keep `computeCoupling`/`computeUnbackedStages` tests (banner
      stays for residual legacy data).

## 5. Verification

- [x] 5.1 `grep -nE '[а-яА-Я]'` over changed
      `apps/web/src/**/*.tsx` — every match is data/comment/test.
      Result 2026-06-11: zero Cyrillic matches in the 7 changed
      production files (the only Cyrillic in touched tests is fixture
      data, allowed).
- [x] 5.2 Gates: `pnpm typecheck && pnpm lint && pnpm test &&
pnpm build` — record results here.
      Result 2026-06-11: typecheck PASS; lint PASS (eslint + stylelint + prisma typecheck); test PASS (112 files, 1043 tests); build
      PASS.
- [x] 5.3 Live walk on :3000 (lead role): raise-without-risk →
      dialog; cancel → unchanged; save → chip floored; lower →
      confirm → risk gone; head review + export show the same
      statuses. Re-check on FRESH seed data, not only the worked
      draft.
      Result 2026-06-11 (Olga's draft, then `db:fresh:advanced` +
      re-walk): raise-without-risk opened the prefilled dialog (stage
      checked, severity pressed), chip unapplied; cancel left the chip
      unchanged; save created the risk and raised the chip with no
      extra confirmation; lower showed "Set stage back to on-track? /
      Deletes 1 risk.", cancel was a no-op, confirm deleted the risk
      and lowered the chip; covered Testing chip rendered floored on
      fresh seed; zero console errors. Caveat: the head Status board /
      print surface did not list Olga's products even after she
      submitted — their portfolio read model is outside this change
      (no head/weekly mappers touched); flagged as an open question.
