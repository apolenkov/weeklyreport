# Require a reason when a lead pauses an item

## Why

Pausing an item was possible with no explanation, so a paused record on the
report gave the head no signal about WHY the work stalled. The 2026-07-06
walkthrough asked for a quick "Pause" action on the card and made the reason
mandatory at the point of pausing.

## What Changes

- New quick "Pause" action on current-week item cards (in-progress items only)
  that opens a required-reason prompt; the item is paused only once a non-blank
  reason is given.
- The item edit dialog's "Paused" choice now shows a required reason field,
  so the reason can't be bypassed through that path either (and editing a
  paused item preserves its reason instead of silently dropping it).
- The reason is persisted (`Item.pausedReason`) and surfaced on the card as a
  muted "Paused: …" line so a reviewer sees the cause at a glance.
- The requirement is enforced at the UI entry points, not as a hard schema
  invariant — legacy paused rows without a reason still load and round-trip.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `record-status-derivation`: pausing an item now requires a reason and
  persists it; the reason surfaces on the card and in the edit dialog.

## Impact

- `prisma/schema.prisma` (+ init migration SQL) — new nullable `Item.pausedReason`.
- `packages/shared/src/schemas/section.schema.ts` — item read/write shape gains
  the optional `pausedReason`.
- `apps/api/src/modules/report-sections/report-sections.prisma-repository.ts` —
  the hand-written `PrismaReportSectionWithRelations` item shape, the read-model
  mapper, and the `saveSection` write all carry `pausedReason`.
- `apps/web` — `KanbanItem`, `mapLeadItems`, `sectionToDraftPayload`, the two
  item merge handlers, a new `pauseItemPatch`, `PauseReasonDialog`,
  `usePauseReason`, `ItemCard`/`ItemCardActions` pause button + reason line, and
  the `ItemEditDialog` required reason field. A shared `BoardEmptyState` is
  extracted so `CurrentWeekSection` stays under the file-size cap.
