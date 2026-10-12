# Design

## Context

See `proposal.md` and the D37-V25 brief. The currently owned draft boundary
already applies patches through a React functional setter. The bridge turns
the existing functional product updater into a captured collection too early;
section callbacks similarly turn item intent into an unconditional patch.

## Goals / Non-Goals

**Goals:** Carry existing authored updates to their latest raw draft boundary,
preserve resolved work and item identity, and align Overview parent selection
with the existing single-stage rule.

**Non-Goals:** Broaden server admission, alter generic outcome restore patches,
or turn conditional React batching evidence into native race acceptance.

## Decisions

- Pass the existing product updater through the bridge and draft adapter.
  Evaluate it inside `applyDraftPatch` against raw owned stage statuses, using
  the shared traffic-status conversion. A display-floored projection must not
  overwrite another raw stage. The explicitly transferred Overview callback
  type accepts the same updater contract.
- Add move, complete and pause intents to the existing draft patch union.
  Resolve each intent against the current item; reuse `buildMoveItemPatch`.
  Keep generic `item-patch` available to authorized outcome restoration.
- Filter unnamed contributors only while selecting the attribution of a
  foreign risk producing the alarm. Preserve own-risk generic copy and the
  existing order among named contributors.
- Use `computeEffectiveStageNames` in Overview's parent-change handler.
  Keep the shared stage leaf and command validator unchanged.

## Risks / Trade-offs

- Missing all foreign names requires a wider boundary repair; this patch
  cannot manufacture an author. That subclaim stays needs-evidence.
- Public Pipeline events within one explicit React batch prove the existing
  updater contract, not native discrete-event ordering or autosave loss.
- Native browser, Safari, AT, DB and final aggregate gates are outside this
  author lane. Coordinator acceptance remains separate.
- No migration is required; rollback reverts these local adapters and tests.
