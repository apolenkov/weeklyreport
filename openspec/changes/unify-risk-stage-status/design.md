# Design — Unify Risk Severity and Stage Status

## Context

Verified current state (2026-06-11):

- `use-status-risk.ts` — `computeCoupling`/`validateCoupling` (pure)
  plus `useStatusRiskSync` (hook). The hook's `handleStageStatusChange`
  applies any chip click unconditionally; `handleRiskFilled` only
  _suggests_ a chip bump via `requestStatusUpdateConfirmation` when the
  bound stage is on-track/empty. Loop guard: `SyncSource` ref
  ("user" vs "auto-sync", Pitfall 5).
- `lead-form-sync-bridge.tsx:332` — `computeUnbackedStages` flags
  at-risk/blocked "mine" stages with no covering non-empty risk
  (blocked requires a blocked risk); rendered as a warning banner in
  `sdlc-pipeline.tsx:151`.
- `lib/stage-status.ts` — `deriveEffectiveStageStatus(explicit, risks,
items)` = max by precedence blocked > at-risk > on-track > empty.
- `lib/mappers/lead-form.ts:399` — `mapLeadProducts` passes `[], []`
  to `buildStageGrid` with the PRJ-2 comment: "Explicit chip status
  must win in the edit form. Passing risks and items here caused
  deriveEffectiveStageStatus to override the user's chip clicks on
  every re-render."
- `riskCoversStage` (`stage-tags.ts:64`) — coverage predicate; the
  empty-`stageIds` = "all stages" branch becomes legacy-only once
  `require-risk-stage` lands (risks then always carry ≥1 stage).
- `risk-edit-dialog.tsx` — hosted inside `risks-section.tsx`; create
  mode already accepts `defaultProductId`; severity/stage prefill
  exists partially (`deriveFromPreChecked`).

Dependency: `require-risk-stage` lands BEFORE this change tonight.
Build on its contract — every risk names its stages explicitly, so
"which chips does this risk cover" is never ambiguous.

## Goals / Non-Goals

**Goals:** one consistent at-risk/blocked signal. Risks are the source
of truth; chips are a projection plus an entry point that routes
through risk creation/deletion.

**Non-Goals:** issue-tracker integration; item-derived chip status
(items stay disconnected); cross-author coupling (foreign risks never
force or get deleted through my chips); schema/API/Prisma changes;
redesign of the pipeline UI.

## Decisions

### D1 — Re-enable risk-derived status; supersede PRJ-2

`mapLeadProducts` re-connects `deriveEffectiveStageStatus` for risks
(items stay `[]`), and the live form applies the same severity floor
at render time. PRJ-2 removed the derivation because it _fought_ user
chip clicks: derivation re-overrode the explicit status on every
re-render, so a user click appeared to not stick. That was a symptom
fix. The root cause was that two writers (explicit clicks and risk
derivation) raced with no protocol. This change defines the protocol:

- Raising a chip above its floor with no covering risk is intercepted
  (D2) — the click never lands without a risk.
- Lowering a chip below its floor is intercepted (D3) — the covering
  risks are deleted first, removing the floor.

With every conflicting transition routed through an explicit flow, the
derivation can no longer "fight" anything — there is no reachable
state where explicit and derived status disagree silently. Hence
re-enabling is safe and the PRJ-2 comment is replaced by a pointer to
this change. The floor applies in BOTH the read-model mapper and the
live form so the lead form, head review, and PDF export agree.

### D2 — Chip raise without a covering risk opens the prefilled dialog

In `handleStageStatusChange`: when the new status is at-risk/blocked
and no covering non-empty risk of sufficient severity exists (same
predicate as `computeUnbackedStages`: blocked needs a blocked risk),
the status change is NOT applied. Instead the bridge opens
`RiskEditDialog` in create mode prefilled with product, the clicked
stage in `stageIds`, and the clicked severity.

- On save: the risk is created; the floor (D1) makes the chip render
  at the chosen severity; the explicit status is also set via the
  existing `applyStatusSuggestion` auto-sync path so persisted state
  matches.
- On cancel: nothing was applied, so "revert" is free — the chip never
  changed.

Mechanics: the dialog is hosted inside `RisksSection`; the bridge
already passes `risksAddSignal` (add-row signal). Extend that channel
to carry an optional prefill payload `{ productId, stageIds,
severity }` instead of lifting the dialog — minimal surface, reuses
the existing dialog lifecycle. Coordinate with the active
`fix-section-add-signal-reset` and `refactor-lead-dialog-lifecycle`
changes if they land first; whoever lands second adapts.

The unbacked-stage banner remains for residual data (drafts saved
before this change can still load with unbacked stages); it no longer
arises from new interactions.

### D3 — Chip lower with covering risks requires confirmed deletion

When the user sets a covered chip to on-track (or empty), a
confirmation dialog (reuse `ConfirmDeleteDialog`) states the
consequence before anything changes. On confirm, for each covering own
risk:

- if the clicked stage is its ONLY stage → delete the risk row;
- if it covers other stages too → remove the clicked stage from its
  `stageIds`, keep the row.

The strip-don't-delete refinement preserves both `require-risk-stage`
(a surviving risk keeps ≥1 stage) and rule D1 on sibling stages — a
blanket delete would silently drop the floor on OTHER chips the risk
covers, recreating the unbacked-stage state this change eliminates.
Dialog copy enumerates both effects ("Deletes N risk(s)" /
"removes this stage from M risk(s)"); strings in English per repo
rule. On cancel, the chip is unchanged. If any covering risk is
cross-author (read-only), the lowering is blocked with an explanatory
message instead of the dialog — a lead cannot delete another lead's
risk.

### D4 — The suggestion flow is replaced by the floor

`handleRiskFilled` → `requestStatusUpdateConfirmation` ("you wrote a
risk, bump the chip?") becomes dead under D1: a saved risk forces the
floor automatically, no opt-in question. Remove the suggestion path
and its consumer wiring; keep the `SyncSource` loop guard for the
D2 auto-apply. Update `use-status-risk-sync.test.tsx` and
`use-status-risk-coupling.test.ts` to the new contract (do not weaken:
the suggestion tests are replaced by floor/interception tests that
pin strictly more behavior).

## Invariants touched

- period-dual-state, role-coverage-gate, destructive-db-guard — not
  touched (web-only, no new procedures, no DB).
- deferred-feature-pattern — not touched; nothing is deferred here.
- risk-stage-integrity (new tonight) — precondition, built upon.

## Risks / Trade-offs

- [Regression-heavy area] CLAUDE.md flags lead sync/query semantics as
  UAT-regression-prone → read the three existing test suites BEFORE
  edits; extend, never rewrite from scratch; keep `computeCoupling`
  exports stable for other consumers.
- [Legacy drafts] persisted explicit on-track + existing covering risk
  now renders at the floor → intended (rule 2), but verify the head
  review/PDF snapshot tests; the stale-persisted-value case gets an
  explicit test.
- [Concurrent active changes] `fix-section-add-signal-reset`,
  `refactor-lead-dialog-lifecycle`, `align-pipeline-arrows` touch the
  same files tonight → implement sequentially, rebase artifacts, adapt
  the signal mechanics to whichever shape landed.
- [Dialog cancel mid-flow] the pending chip intent must not leak: D2
  never applies the status before save, so an abandoned dialog needs
  no rollback bookkeeping.
