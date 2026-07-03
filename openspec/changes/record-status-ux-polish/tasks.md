# Tasks — record-status-ux-polish

## 1. In-dialog locked message + route-through-blocker

- [ ] 1.1 Thread the section's own risks into `item-edit-dialog.tsx`; for a
      covered item render the locked message in place of the status chips.
- [ ] 1.2 For an uncovered item, an alarm gesture opens the risk (blocker) dialog
      prefilled with the item's product, stage, and the chosen severity.

## 2. Quick-add "Blocker" severity prefill

- [ ] 2.1 Thread a one-shot blocked-severity risk-prefill from `handleQuickAdd`
      ("blocker") through `LeadFormSyncBridge` so the risk dialog opens pre-set to
      severity `blocked` (today it opens at the pipeline-derived default = at-risk).
- [ ] 2.2 Test: quick-add "Blocker" → the risk dialog's severity is blocked.

## 3. Foreign attribution

- [ ] 3.1 `item-card.tsx`: when a foreign covering risk floors an item, name the
      other author in the lock affordance (mirror the stage-chip foreign handling).

## 4. Verification

- [ ] 4.1 `pnpm typecheck` + `pnpm lint` (`--max-warnings 0`) green.
- [ ] 4.2 `pnpm test` green including the new dialog / quick-add / attribution tests.
- [ ] 4.3 `openspec validate record-status-ux-polish --strict`.
