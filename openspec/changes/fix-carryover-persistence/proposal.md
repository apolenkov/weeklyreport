## Why

When a new weekly period opens, the head triggers carry-over so each lead's
unfinished next-week items and unresolved decisions move into the new report.
Today the write path silently drops most of that data and crashes outright the
moment any source decision is unresolved — the exact case carry-over exists to
serve. The single integration test uses empty decisions and one section, so the
breakage ships green (see `BL-CARRYOVER-PERSISTENCE` /
`docs/repo-excellence-review-2026-06-28.md`).

The repository write path (`apps/api/src/modules/carry-over/carry-over.prisma-repository.ts`)
fails on four fronts:

- It writes a non-existent Prisma field `stageName` on carried decisions, which
  aborts the whole `$transaction` whenever a source has an unresolved decision
  with a product (`prisma/schema.prisma:351` defines `stageNames String[]`).
- The service computes carried rows for every lead's section but passes only the
  FIRST target section to `saveCarryOver`, so every lead after the first loses
  all carried items and decisions while the execution row still counts them.
- Carried items are created without `priorityRank` or `stageNames`, so ranking
  and stage labels vanish across the period boundary.
- The execution insert is a check-then-create with no handling for the unique
  `dedupeKey` race, so two concurrent carry-overs surface a raw P2002 as a 500.

## What Changes

- Persist carried items and decisions for ALL target sections, not just the
  first; the persisted record count matches the execution's reported counts.
- Keep the `authorId` matching rule but stop counting/recording carried rows
  from a source lead that has no matching target section, so counts and
  `CarryOverRecord` rows never exceed what is persisted (no dangling targets).
- Write carried-decision and carried-item stage labels as `stageNames` (array),
  mirroring `report-sections.prisma-repository.ts`; remove the bad `stageName`.
- Carry `priorityRank` and `stageNames` onto created items.
- Handle the `dedupeKey` uniqueness race idempotently: a concurrent duplicate is
  treated as the already-recorded execution (or a friendly domain conflict),
  never a 500 — without resurrecting a `failed` status write.
- Extend integration coverage: unresolved decision, item with
  `priorityRank` + `stageIds`, and a multi-section (multi-lead) report.

## Capabilities

### New Capabilities

- `carry-over-persistence`: how the carry-over write path persists unfinished
  items and unresolved decisions across every lead's section into the next
  period, including stage labels, priority rank, and concurrency safety.

### Modified Capabilities

<!-- none: no existing capability owns carry-over write behavior -->

## Impact

- `apps/api/src/modules/carry-over/carry-over.prisma-repository.ts` — fix field
  name, persist all sections, add `priorityRank`/`stageNames`, handle P2002.
- `apps/api/src/modules/carry-over/carry-over.service.ts` — pass all target
  sections (signature/loop) instead of only the first.
- `apps/api/src/modules/carry-over/carry-over.integration.test.ts` — new cases.
- No schema change: columns already exist; respects enum-state-hygiene
  (no `failed` write introduced).
