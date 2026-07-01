## Why

A report record — an `Item`, `Risk`, or `Decision` — has **no identity that
survives a save**. `saveSection`
(`apps/api/src/modules/report-sections/report-sections.prisma-repository.ts`)
deletes every child row for the section and recreates them wholesale, letting the
database mint fresh primary keys on every write (the `deleteMany` → `createMany`
block, with the explicit "the DB mints the id — rows are recreated wholesale"
note added by `add-section-optimistic-lock`). So the row `id` a record had before
a save is gone after it. Carry-over compounds this: `cloneCarriedItem` /
`cloneUnresolvedDecision` (`carry-over.service.ts`) mint a brand-new
`crypto.randomUUID()` for the carried instance, so the same работа continuing into
the next period is a different row again.

Three separate record-level features are blocked on this one gap, each assuming a
key that outlives a save:

- **Published-record lifecycle lock** (`unified-activity-entry`, tasks 4b.1 / 5.5)
  — "a published record can only be resolved or carried, never silently removed"
  needs to recognise a published-origin record across saves AND across a carried
  clone. The volatile row `id` cannot; the design there flags this as the real
  first task, "bigger than this change alone."
- **Move-in-place** (`unified-activity-entry`, task 4.1) — "mark complete" / "move
  to next week" must mutate in place and keep the same identity, "NOT a
  delete-recreate that mints a new id." False today against the recreate path.
- **Per-record review comments** (`review-acknowledgement`) — a comment anchored to
  a record's `id` orphans on the very next save when that `id` changes.

`add-section-optimistic-lock` is already landed (the `version` compare-and-set and
the server-minted child ids are in the code), and it is the reason child PKs are
deliberately DB-minted. This change does **not** reintroduce client-supplied PK
trust; it adds a **separate, non-PK lineage key** alongside the DB-minted id.

## What Changes

Introduce a durable per-record lineage key — `stableId` — on `Item`, `Risk`, and
`Decision`, minted once and carried through every write:

- **Minted once.** `stableId String @default(uuid())` on each of the three models;
  a record with no explicit value gets one at first create, distinct from its
  DB-minted PK `id`.
- **Preserved through the recreate.** `saveSection`'s `createMany` persists the
  `stableId` from the read model instead of dropping it, so the delete-recreate no
  longer resets record identity. The value is surfaced on the read model,
  round-tripped through the save payload, and written back — the same end-to-end
  threading `add-section-optimistic-lock` used for `version`.
- **Copied by carry-over.** `cloneCarriedItem` / `cloneUnresolvedDecision` keep the
  source record's `stableId` on the clone (the clone still gets a fresh PK `id`), so
  a carried item / decision shares one lineage key with its origin. `saveCarryOver`
  (`carry-over.prisma-repository.ts`) — a second, distinct write path — must persist
  `stableId` in its own `createMany`, which it does not list today.

`stableId` is a **lineage key, not a per-row id**: a carried clone shares its
origin's `stableId`, so it identifies a позиция across periods. Period-scoped
features combine it with the section — `(reportSectionId, stableId)` — which is
period-unique because `ReportSection` is `@@unique([reportId, authorId])`.
Lineage-wide features (the lifecycle lock) query `stableId` alone. This split is the
crux of the design; see `design.md`.

This is a **foundation only**. It ships schema + both save paths + carry-over so a
stable key exists to attach to. It does **not** implement the lifecycle lock,
move-in-place, or comment anchors — those remain owned by their own changes and
build on this key.

### Scope

`Item`, `Risk`, `Decision` only. `ProjectStatus` / `StageStatus` are also
delete-recreated but no record-level feature anchors to them. Carry-over copy
covers items + decisions only — **risks are not carried today**
(`carryOver.execute` clones neither); risks get mint + preserve-through-save, with
no carry path to extend until a change adds risk carry-over.

## Capabilities

### New Capabilities

- `durable-record-identity`: a per-record lineage key on items, risks, and
  decisions that is minted once, preserved through `saveSection`'s
  delete-recreate, and copied onto a carried clone — the stable identity that
  record-level features (lifecycle lock, move-in-place, comment anchors) attach to.

### Modified Capabilities

<!-- none: no existing capability governs a durable per-record identity -->

## Impact

- `prisma/schema.prisma` (`stableId` on `Item` / `Risk` / `Decision` + index) and
  the single init migration SQL (MVP disposable DB).
- `packages/shared/src/schemas/section.schema.ts` — `stableId` on the item / risk /
  decision inputs (optional); the read models inherit it (also optional — see the
  design "Optional read model" note: `mergeSection` parses save inputs against the
  read-model schema, so a required field would reject a brand-new record).
- `apps/api/src/modules/report-sections/report-sections.prisma-repository.ts` —
  `saveSection` `createMany` persists `stableId`; `mapPrismaToReportSection` surfaces
  it (the hand-written `PrismaReportSectionWithRelations` row type declares it too).
- `apps/api/src/modules/carry-over/carry-over.service.ts` — clones keep the source
  `stableId`; `carry-over.prisma-repository.ts` `saveCarryOver` persists it.
- `apps/web/src/components/lead/lead-form.tsx` — `sectionToDraftPayload` round-trips
  `stableId` in the save payload (the original Impact list missed the web link; the
  merge handlers already preserve it via `...existing`). Without this, the round-trip
  breaks and identity re-mints on every save.
