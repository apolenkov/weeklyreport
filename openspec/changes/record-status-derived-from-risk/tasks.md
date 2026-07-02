# Tasks — record-status-derived-from-risk

## 0. Sign-off gate (blocking)

- [ ] 0.1 Confirm Option A vs Option B for the stored representation
      (`design.md` Decision 2) with the owner — A reverses two locked 2026-06-30
      decisions. Do not start §3/§5 until resolved.
- [ ] 0.2 Confirm the "blocker = risk of severity blocked" reframe (open
      question 2) — this changes the lead's mental model and the quick-add flow.

## 1. Derivation helper (shared)

- [ ] 1.1 Add `deriveItemAlarmFromRisks` to `apps/web/src/lib/mappers/lead-form.ts`,
      a sibling of `deriveEffectiveStageStatus`: given an item + the section's risks,
      return the highest covering severity (`blocked > at-risk`) or none.
- [ ] 1.2 Implement the coverage rule per `design.md` Decision 1 (same section +
      product + stage overlap; empty risk `stageNames` = wildcard; stage-less item =
      covered by any same-product risk).
- [ ] 1.3 Unit-test the helper: covering blocked, covering at-risk, mixed →
      highest, no coverage → none, wildcard-stage risk, stage-less item, foreign risk.

## 2. Item card render (locked pill + message)

- [ ] 2.1 `item-card.tsx`: derive the alarm pill from `deriveItemAlarmFromRisks`
      (not `item.status`); render blocked/at-risk via named `--color-*` tokens per
      `status-color-semantics`; show progress status when uncovered. Only floor an
      `in-progress` item — completed/planned items keep their progress pill.
- [ ] 2.2 Add a NEW `at-risk` entry to `STATUS_BADGE` (amber, token-derived —
      `--color-status-at-risk-bg` / `--color-status-at-risk-fg`); the badge map has
      no at-risk variant today.
- [ ] 2.3 Add the covered-item lock affordance (tooltip/inline note): "Resolve
      the covering risk/blocker to change this status." — English only.
- [ ] 2.4 Foreign covering risk: render the alarm, name the other author, offer
      no deletion (mirror stage-chip foreign handling).
- [ ] 2.5 Component tests: derived blocked, derived at-risk, uncovered progress,
      completed item under a covering risk stays completed, lock message present
      when covered, foreign attribution.

## 3. Item dialog + quick-add (route-through-blocker)

- [ ] 3.1 `item-edit-dialog.tsx`: remove the free `blocked` chip from
      `CURRENT_WEEK_CHOICES`; for an uncovered item, an alarm gesture opens the risk
      (blocker) dialog prefilled with product + item stage + chosen severity.
- [ ] 3.2 For a covered item, replace the alarm chips with the locked message.
- [ ] 3.3 `quick-add-button.tsx`: the "blocker" entry opens the risk (blocker)
      dialog (severity blocked), not a blocked item; update its tests.
- [ ] 3.4 Cancel of the prefilled risk dialog leaves the item unchanged (test).

## 4. Stored-representation invariant + Zod

- [ ] 4.1 Enforce no stored item alarm without a covering risk on the write path
      (`report-sections` repository saveSection): reject/ignore a stored `blocked`
      that has no covering blocked risk.
- [ ] 4.2 Option A: remove `blocked` from `ItemWorkflowStatus`
      (`prisma/schema.prisma`) and the Zod mirror `itemWorkflowStatusSchema`
      (`packages/shared/src/schemas/section.schema.ts`); regenerate the Prisma client
      (`pnpm --filter @customreport/api db:generate`). Option B: keep the enum, add
      the write invariant only.
- [ ] 4.3 Update the domain↔db mapper and any `ItemStatus` type in
      `apps/web/src/components/lead/mock-data.ts` so `at-risk` is display-only and
      `blocked` is not a free item status.

## 5. Migration / backfill (heal legacy blocked)

- [ ] 5.1 Author the forward migration (hand-edit the init migration SQL if
      Prisma cannot express it) per `design.md` Decision 3: for each `blocked` item
      with no covering blocked risk, synthesize a covering `Risk(severity=blocked)`
      in the same section/product/stage; Option A also sets the item to `in_progress`.
- [ ] 5.2 Update seeds (`prisma/seed*`) so no seeded item uses a bare `blocked`
      without a covering risk; re-apply via `prisma migrate reset`
      (`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`).
- [ ] 5.3 Verify no seeded/updated item's displayed pill disagrees with its
      stored value after reseed.

## 6. Escalation reconciliation

- [ ] 6.1 `buildEscalationsFromReadSections` (`published-report-snapshot.ts`):
      Option A re-source the `blocked` escalation from blocked-severity risks so a
      blocker yields one escalation; Option B dedupe a blocked item against its
      covering blocker. Ensure the roll-up count does not inflate.
- [ ] 6.2 Test: a blocked item + its covering blocker → one escalation; an
      independent at-risk risk → `unresolved_risk` unchanged; live dashboard and
      published snapshot receive the same reconciled count.
- [ ] 6.3 If this reconciliation is deferred to a follow-up
      (`reconcile-blocked-escalation-source`), link it here and do not archive this
      change until it lands.

## 7. Verification

- [ ] 7.1 `pnpm --filter @customreport/api db:generate` then `pnpm typecheck` — green.
- [ ] 7.2 `pnpm lint` — clean with zero warnings (`--max-warnings 0`); no new
      `eslint.config.ts` exempt entry for touched files.
- [ ] 7.3 `pnpm test` (web + api unit) — green, including the new helper, card,
      dialog, quick-add, and escalation tests.
- [ ] 7.4 `pnpm test:integration` (single-thread) — saveSection write invariant
      and escalation reconciliation pass against the real DB.
- [ ] 7.5 Live-verify from source (docker image is stale): the item pill is
      locked and derived, the "Blocked" gesture opens the risk dialog, and the
      quick-add "blocker" opens the risk dialog.
- [ ] 7.6 `grep -nE '[а-яА-Я]' <changed .tsx>` — every hit is data/comment/test.
- [ ] 7.7 `openspec validate record-status-derived-from-risk --strict` — passes.
