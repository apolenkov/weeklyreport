# Item-alarm UX polish — in-dialog lock, prefilled blocker routing, foreign attribution

## Why

`record-status-derived-from-risk` shipped the load-bearing invariant: an item's
at-risk/blocked pill is derived at render from its covering risks (never a free
toggle), the free Blocked chip is gone from the item dialog, the escalation and
head-report badge are re-sourced from risks, and legacy blocked items are healed.

Four UX REFINEMENTS on top of that invariant were consciously deferred from the
shipped slice to keep a large coupled change bounded (the invariant holds without
them). They are relocated here rather than dropped, so the parent change archives
honestly. See `openspec/changes/archive/*/record-status-derived-from-risk`.

## What Changes

- **In-dialog locked message for a covered item.** When the item edit dialog
  opens for an item that a covering risk already floors, show an inline message in
  place of the (removed) alarm chips: the status is set by the covering
  risk/blocker — resolve it to change. Requires threading the section's risks into
  the item dialog. Shipped slice removed the free chip but shows no in-dialog lock
  copy.
- **In-dialog route-through-blocker.** An alarm gesture inside the item dialog on
  an uncovered item opens the risk (blocker) dialog prefilled (product + stage +
  severity). Shipped slice routes "set blocked" only through the quick-add
  "Blocker" entry, not from inside the item dialog.
- **Quick-add "Blocker" defaults to blocked severity.** The quick-add "Blocker"
  entry must open the risk dialog pre-set to severity `blocked` (today it opens at
  the dialog's derived default, which is `at-risk` when no stage is pipeline-
  flagged — so a "Blocker" saved without a manual severity switch is not a
  blocker). Needs a one-shot severity prefill threaded through the
  `LeadFormSyncBridge` risk-prefill path (the load-bearing status↔risk bridge);
  deferred to avoid touching that bridge at the tail of the parent change.
- **Foreign covering-risk attribution.** When an item's covering risk belongs to
  another author, the lock affordance names the other author (mirroring the
  stage-chip foreign handling) instead of the generic lock copy.

## Capabilities

### Modified Capabilities

- `record-status-derivation`: ADDS scenarios for the in-dialog lock message, the
  in-dialog prefilled blocker routing, the blocker-severity quick-add default, and
  foreign covering-risk attribution. No parent requirement is contradicted — these
  refine the already-shipped locked-alarm and route-through-blocker requirements.

## Impact

- `apps/web/src/components/lead/item-edit-dialog.tsx` — thread the section's risks;
  render the locked message for a covered item; alarm gesture opens the prefilled
  risk dialog.
- `apps/web/src/components/lead/lead-form.tsx` + `lead-form-sync-bridge.tsx` — a
  one-shot blocked-severity risk-prefill for the quick-add "Blocker".
- `apps/web/src/components/lead/item-card.tsx` — name the other author in the lock
  affordance for a foreign covering risk.
