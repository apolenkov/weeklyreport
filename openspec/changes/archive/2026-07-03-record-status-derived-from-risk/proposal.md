# Record status is derived from risks/blockers, not set freely

## Why

Live lead-surface feedback D2 (`docs/feedback/lead-surface-annotations-2026-07-02.md`,
F3): on an item card the at-risk/blocked status pill is a free choice. The lead
opens the item dialog and toggles the "Blocked" chip by hand
(`apps/web/src/components/lead/item-edit-dialog.tsx` `CURRENT_WEEK_CHOICES`), and
the quick-add "blocker" opens that same dialog with `blocked` preselected — "a
blocker is a current item with `workflowStatus=blocked`, not a new record type."

That contradicts the invariant this codebase already enforces for stage chips:
**risks are the single source of truth for at-risk/blocked**
(`openspec/specs/status-risk-unification`). A stage chip cannot be set to
at-risk/blocked without a covering risk row; a covered chip is floored at render
and can only be lowered by removing the risk. The item card is the one surface
where the same alarm can still be authored free-hand, so the two surfaces
disagree: a lead can mark an item blocked with no risk behind it, and can clear a
blocked item while its covering risk still stands.

The feedback fixes the direction: an item's at-risk/blocked pill is the
**roll-up of its covering risks/blockers**, not a free toggle. When a risk or
blocker covers the item the alarm is locked — the lead cannot clear it from the
card; the UI says to resolve the covering risk/blocker first. The pill colours
ARE the risk/blocker roll-up (blocked = red, at-risk = amber), reinforcing
`status-color-semantics` rather than changing it.

## What Changes

- **Derivation rule.** An item card's at-risk/blocked pill is derived at render
  from the covering risk rows — the highest covering severity wins
  (blocked > at-risk). No covering risk means no alarm; the item shows its
  progress status (in-progress / completed / planned). This mirrors the
  stage-chip render floor (`deriveEffectiveStageStatus`), extended to the item
  card (`apps/web/src/components/lead/item-card.tsx`).
- **Locked alarm UX.** When a covering risk/blocker exists the item's alarm
  cannot be cleared or downgraded from the card or the item dialog: the alarm
  controls are removed/disabled and an inline message directs the lead to
  resolve the covering risk/blocker first. A foreign covering risk shows the
  alarm but names the other author, mirroring the stage-chip foreign handling.
- **Setting an alarm routes through blocker creation.** An attempt to set an
  uncovered item to at-risk/blocked opens the risk (blocker) edit dialog
  prefilled with the product, the item's stage, and the chosen severity — never
  storing a free alarm on the item. The quick-add "blocker" creates a blocker
  record (a risk of severity `blocked`), not a free-blocked item. This reverses
  the 2026-06-30 locked decision "blocker = `Item.workflowStatus=blocked`"
  (`docs/feedback/decisions-locked-2026-06-30.md`) — see open questions.
- **Stored-representation invariant.** `at-risk` is never a stored `Item`
  status (the amber pill comes only from a covering at-risk risk at render), and
  no stored `blocked` may exist without a covering blocked-severity risk. This
  removes the stored-vs-derived drift the "muddy middle" would allow.
- **Escalation consistency.** A blocked item and its covering blocker must not
  appear as two separate escalations in the published-report / dashboard
  roll-up (`buildEscalationsFromReadSections` in
  `apps/api/src/modules/published-report-snapshot.ts` reads stored
  `item.workflowStatus === "blocked"` today).
- **Cross-spec coherence.** `status-risk-unification` gains a sibling
  requirement naming the item card as a governed surface, so the single-source
  invariant spans both stage chips and item cards.

## Capabilities

### New Capabilities

- `record-status-derivation`: the item card's at-risk/blocked pill is a derived
  roll-up of its covering risks; the alarm is locked when covered; setting an
  alarm routes through blocker creation; no unbacked stored alarm; the
  escalation roll-up does not double-count a blocked item and its blocker.

### Modified Capabilities

- `status-risk-unification`: ADDS one sibling requirement extending the
  single-source-of-truth rule from stage chips to item cards. No existing
  requirement header is modified (collision-safe with the in-flight
  stage-chip requirements).

## Impact

- `apps/web/src/components/lead/item-card.tsx` — status pill derives the alarm
  from covering risks; renders the locked message; adds a covered-item tooltip.
  Its `STATUS_BADGE` map gains a NEW derived `at-risk` (amber, token-derived)
  variant — the item badge set today has no at-risk entry, so this is a new
  rendered pill on the lead card. `status-color-semantics`'s head-report item
  badge requirement still enumerates four states (blocked / in-progress /
  completed / planned); extending that surface to the derived at-risk is
  out of scope here and flagged for parity review (see open questions).
- `apps/web/src/components/lead/item-edit-dialog.tsx` — the free at-risk/blocked
  chips are replaced by a route-through-blocker affordance; the alarm chip is
  removed from `CURRENT_WEEK_CHOICES`.
- `apps/web/src/components/lead/quick-add-button.tsx` — the "blocker" quick-add
  opens the risk (blocker) dialog, not a blocked item.
- `apps/web/src/lib/mappers/lead-form.ts` — a shared item-alarm derivation
  helper (sibling to `deriveEffectiveStageStatus`) computes the covering-risk
  roll-up for the item card.
- `prisma/schema.prisma` + `packages/shared/src/schemas/section.schema.ts` — the
  stored-representation invariant (see `design.md` for the enum decision) and
  the migration/backfill that heals legacy unbacked `blocked` items.
- `apps/api/src/modules/published-report-snapshot.ts` — the escalation `blocked`
  source is reconciled so a blocked item and its covering blocker are not
  double-counted.
- Specs: new `record-status-derivation`; `status-risk-unification` gains a
  sibling requirement. `status-color-semantics` is reinforced (blocked = red,
  at-risk = amber, token-derived) but NOT changed — verified non-contradictory.
