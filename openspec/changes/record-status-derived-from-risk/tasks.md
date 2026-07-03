# Tasks — record-status-derived-from-risk

## 0. Sign-off gate (blocking)

- [x] 0.1 Option A vs Option B — RESOLVED by the owner-delegated council
      (`docs/feedback/council-decisions-2026-07-02.md` "RESOLVED 2026-07-03"):
      **Option A (derive-only), PURE OVERLAY, PHASED.** DEFER only the
      `ItemWorkflowStatus.blocked` enum-VALUE removal.
- [x] 0.2 "blocker = risk of severity blocked" reframe — confirmed by the same
      council lock.

## 1. Derivation helper (shared)

- [x] 1.1 `deriveItemAlarmFromRisks` — landed in `apps/web/src/lib/item-alarm.ts`
      (a dedicated module, cleaner than the planned `mappers/lead-form.ts` home).
- [x] 1.2 Coverage rule per `design.md` Decision 1 (same product + stage overlap;
      empty risk stageNames = wildcard; stage-less item = covered by any).
- [x] 1.3 Unit tests (12) — `item-alarm.test.ts`.

## 2. Item card render (locked pill + message)

- [x] 2.1 `item-card.tsx` derives the pill from `deriveItemAlarmFromRisks` (via
      `deriveCardStatus`), floors only in-progress items, coerces a legacy stored
      `blocked` to in-progress, and only for product-parented OWN items (activity
      items and foreign items trust their upstream status — Q1 isolation + the
      author's own overlay).
- [x] 2.2 `at-risk` amber added to `STATUS_BADGE` (token-derived).
- [x] 2.3 Covered-item lock affordance (a `title` on the pill).
- [~] 2.4 Foreign covering-risk attribution — DEFERRED to `record-status-ux-polish`
  (the card locks + trusts the author's baked status; it does not yet NAME the
  other author in the lock copy).
- [x] 2.5 Component tests (`item-card.test.tsx`): derived blocked/at-risk,
      uncovered progress, completed-stays-completed, lock message, activity-not-
      derived, legacy-blocked coercion, foreign-trusts-baked.

## 3. Item dialog + quick-add (route-through-blocker)

- [x] 3.1 (partial) `item-edit-dialog.tsx`: the free `blocked` chip is removed from
      `CURRENT_WEEK_CHOICES`; a legacy blocked item opens as in-progress. The
      in-dialog alarm-gesture → prefilled risk dialog is DEFERRED to
      `record-status-ux-polish` (the primary route-through is the quick-add).
- [~] 3.2 In-dialog locked message for a covered item — DEFERRED to
  `record-status-ux-polish` (needs the section's risks threaded into the dialog).
- [x] 3.3 `quick-add "blocker"` opens the risk (blocker) dialog via the risk
      add-signal (a blocker is a blocked-severity risk), not a blocked item.
      NOTE: it opens at the dialog's derived default severity (`at-risk` when no
      stage is pipeline-flagged); the blocked-severity PREFILL is DEFERRED to
      `record-status-ux-polish` (needs the load-bearing sync-bridge risk-prefill).
      Tests updated (`quick-add-button.test.tsx`).
- [x] 3.4 Cancel of the risk dialog leaves the item unchanged (existing behavior).

## 4. Stored-representation invariant + Zod

- [~] 4.1 Server write invariant (reject stored `blocked` w/o covering risk) — NOT
  added (pure-overlay: the UI never authors `blocked`, robustness lives in the
  display coercion; couples to the deferred enum removal). Recorded, not silent.
- [~] 4.2 Remove `blocked` from the enum + Zod — DEFERRED per the council lock
  (near-moot under the disposable-DB MVP). The value stays; nothing writes it.
- [x] 4.3 `at-risk` is display-only and `blocked` is not a free item status: the
      item dialog offers only progress chips; the card derives the alarm.

## 5. Migration / backfill (heal legacy blocked)

- [x] 5.1 No schema migration (enum unchanged). Seed heal in `prisma/seed.ts`:
      Olga's DevOps item (`5156`) flipped to `in_progress`; a covering
      blocked-severity risk (`riskId(6)`, 209/DevOps) synthesized; the risk upsert
      now carries explicit `severity`.
- [x] 5.2 Seeds updated so no seeded item is bare-blocked without a covering risk.
- [ ] 5.3 Reseed (`prisma migrate reset`) + eyeball item 5156 renders Blocked
      (derived) with no stored-vs-displayed disagreement. PENDING live run.

## 6. Escalation reconciliation

- [x] 6.1 `buildEscalationsFromReadSections`: `blockedRiskEscalations` sources
      `blocked` from blocked-severity risks (REPLACING the item source);
      `unresolvedRiskEscalations` narrowed to non-blocked severities so a
      blocked-severity risk yields exactly ONE escalation. null-projectId skip kept.
- [x] 6.2 Tests: blocked-severity risk → one `blocked` (never also
      `unresolved_risk`); at-risk → `unresolved_risk`; stored blocked item no longer
      a source; live-path parity (`weekly-report.prisma-repository.test.ts`).
- [x] 6.3 Landed together (no separate follow-up needed).

## 7. Verification

- [x] 7.1 `pnpm typecheck` — green (web + api).
- [x] 7.2 `pnpm lint` — clean, `--max-warnings 0`, no new exempt entry.
- [x] 7.3 `pnpm test` — green (web 1503, api 1396) incl. the new tests.
- [ ] 7.4 `pnpm test:integration` — PENDING live run (saveSection + escalation).
- [ ] 7.5 Live-verify from source — PENDING.
- [x] 7.6 `grep -nE '[а-яА-Я]'` on changed `.tsx` — every hit is data/comment/test.
- [ ] 7.7 `openspec validate record-status-derived-from-risk --strict` — run below.

## Deferred (relocated, not dropped)

The following UX refinements are tracked in the follow-up change
`record-status-ux-polish` (the council authorized deferring the enum value; the
extra three below are a conscious, recorded deviation — the invariant holds
without them): in-dialog locked message (§3.2), in-dialog prefilled blocker
routing (§3.1), quick-add "Blocker" blocked-severity prefill (§3.3), foreign
covering-risk author attribution (§2.4). The enum-value removal (§4.2) stays
deferred per the council lock.
