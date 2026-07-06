# Proposal: rework-item-status-model

## Why

A lead editing a next-week item sees an "In Progress" chip and a covered-status lock that make no sense; "planned" is not a real status but a projection over `type` + `completed=null`; `completed` is a tri-state boolean living beside the enum; a legacy `blocked` value survives in the enum although alarms derive from risks. The owner hit all four in one live session (2026-07-05) and asked to rework statuses properly. Supersedes and absorbs `add-item-paused-postponed-statuses`.

## What Changes

- **One source of truth.** `ItemWorkflowStatus` becomes `planned | in_progress | paused | postponed | done`. **BREAKING (dev-only):** stored `blocked` is removed (risks own alarms — escalations already read risks, not items); the tri-state `Item.completed` column is dropped (done-ness lives in the enum).
- **Per-type allowed sets**, validated in shared Zod: current → `in_progress | paused | done`; next → `planned | postponed`.
- **Item dialog rework:** per-type status chips; the "Mark as blocked…" button is removed (blockers are created in Risks & Blockers); the covered-status lock stays (it enforces the derivation) with unchanged copy.
- **Slides:** paused = pause glyph, postponed = forward glyph, both dashed-frame; planned/in_progress unchanged dashed; done unchanged green.
- **Carry-over:** a carried next item materializes as `in_progress`; postponed items are NOT auto-carried (explicit re-plan).
- **Read surfaces + analytics:** every `workflowStatus`/`completed` switch gets explicit arms; `item-status.ts` projection collapses to a read of the enum (ADR 0011's principle holds — the projection just becomes trivial).
- Seeds: exemplars for every status in the small tier. Dev DB reshape via `migrate reset` (MVP rules).

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `record-status-derivation`: stored status set changes (no stored `blocked`; `planned` becomes stored; paused/postponed added with not-done, non-escalating rollups); the item-dialog requirement drops the Mark-as-blocked affordance.
- `status-slide-rendering`: tone mapping for the two new states within the no-status-words frame language.

## Non-goals

- No risk/decision status changes; no auto-transitions beyond the carry-over rule above; no slide-row editing (`edit-slide-item-inline`); no prod migration path (no prod exists).

## Impact

- `prisma/schema.prisma` (enum + drop `Item.completed`), seeds, `packages/shared` item schemas, api write validation + rollups/analytics arms, web form dialog + mappers (`item-status.ts`, kanban types) + slides + PDF template.
- Replaces `openspec/changes/add-item-paused-postponed-statuses` (folded in, dir removed).
