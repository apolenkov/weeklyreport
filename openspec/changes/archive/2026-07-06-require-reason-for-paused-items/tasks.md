# Tasks

## 1. Persistence (schema → shared → API)

- [x] 1.1 `prisma/schema.prisma` + init-migration SQL: nullable `Item.pausedReason`;
      `migrate reset` + regenerate the client.
- [x] 1.2 `packages/shared/src/schemas/section.schema.ts`: optional `pausedReason`
      on the item input/read shapes (permissive — no hard paused⟺reason refine).
- [x] 1.3 API: `PrismaReportSectionWithRelations` item shape, the read-model
      mapper, and the `saveSection` write all carry `pausedReason`.

## 2. Web authoring + display

- [x] 2.1 `KanbanItem` + `mapLeadItems` + `sectionToDraftPayload` + the two item
      merge handlers round-trip `pausedReason` (cleared when not paused).
- [x] 2.2 `pauseItemPatch`; `PauseReasonDialog`; `usePauseReason` hook; the card
      Pause button (`ItemCardActions`, current-week in-progress) wired through
      `CurrentWeekSection`.
- [x] 2.3 `ItemCard` renders the "Paused: …" reason line.
- [x] 2.4 `ItemEditDialog` required reason field for the Paused status
      (`PausedReasonField`), preserving the reason on edit.
- [x] 2.5 Extract shared `BoardEmptyState` so `CurrentWeekSection` stays under
      the file-size cap.

## 3. Tests + verify

- [x] 3.1 Unit: `pauseItemPatch`, `PauseReasonDialog`, `ItemCard` pause
      button + reason line.
- [x] 3.2 Full gates green (db:generate → typecheck → lint → unit; shared 360 /
      web 1560 / api 1410).
- [x] 3.3 Live-verify on :3000: pause an item with a reason, reload, confirm the
      reason persists and shows; edit-dialog Paused requires a reason.
