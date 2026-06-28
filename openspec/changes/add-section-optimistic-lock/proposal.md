## Why

A lead's report section can silently lose content. `saveSection` deletes every
child row (items, risks, decisions, project and stage statuses) and recreates
them from the client's read model inside one transaction, with no concurrency
check. Two writers for the same section — the same user in two tabs, autosave
racing a manual save, or a retried request — each wipe-and-recreate, so the
last write silently discards the other's work (last-writer-wins). The schema
already carries the deferred `TODO(v8.5-A-occ)` for exactly this gap
(`prisma/schema.prisma` line 241). The review backlog flags it P0
(`BL-SECTION-OPTIMISTIC-LOCK`, `docs/repo-excellence-review-2026-06-28.md`).

Two related defects ride along: the recreate honours client-supplied child PKs
(`i.id` / `r.id` / `d.id`), so a stale or cross-section id collides and surfaces
as a raw 500 (`P2002`); and `createMany` omits `createdAt`, resetting row
provenance on every save.

## What Changes

- Add `version Int @default(1)` to `ReportSection` and increment it on every
  successful write; hand-sync the single init migration (MVP disposable DB).
- Replace the unconditional `reportSection.update` in `saveSection` with a
  conditional `updateMany where { id, version: expected }`; when the result
  count is `0`, abort with a new conflict domain error mapped to tRPC
  `CONFLICT` (HTTP 409). The client round-trips the `version` it loaded.
- **BREAKING** (internal contract): carry a required `version` on the section
  read model and the draft/submit save payload so the client can send the
  expected value and refresh after a 409. Web and API must ship together.
- Stop trusting client-supplied child ids on create — let the database mint
  them (or catch `P2002` and surface `BAD_REQUEST`).
- Preserve `createdAt` provenance where the read model carries it.
- Apply the same conflict guard to `fillFromSection`, which has the identical
  delete-then-recreate shape.

## Capabilities

### New Capabilities

- `report-section-write-integrity`: optimistic-concurrency control for section
  writes — version compare-and-set, 409 on conflict, server-minted child ids,
  preserved provenance.

### Modified Capabilities

<!-- none: no existing capability governs section write concurrency -->

## Impact

- `prisma/schema.prisma` + the init migration (`version` column).
- `apps/api/src/modules/report-sections/report-sections.prisma-repository.ts`,
  `lead-form.prisma-repository.ts`, `report-sections.service.ts`.
- `apps/api/src/infrastructure/trpc/trpc.error-mapper.ts` (new 409 branch).
- `packages/shared/src/schemas/section.schema.ts` (read model + save payload).
- `apps/web` lead form save path (send + refresh on 409).
