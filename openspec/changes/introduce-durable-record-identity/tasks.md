## 0. Characterization test first (proves the gap)

- [ ] 0.1 Add a real-DB integration test through `saveDraft`: create a section with
      one item, save, capture the item's `stableId`; edit unrelated text and save
      again; assert the item's `stableId` is UNCHANGED across the save (its PK `id`
      may change). Starts RED against today's recreate — no `stableId` exists yet.

## 1. Prisma model + migration (prisma)

- [ ] 1.1 Add `stableId String @default(uuid())` to `Item`, `Risk`, `Decision` in
      `prisma/schema.prisma`.
- [ ] 1.2 Add `@@index([stableId])` and `@@unique([reportSectionId, stableId])` to
      each of the three models (lineage lookup + per-section integrity guard).
- [ ] 1.3 Hand-sync the single init migration SQL: `stableId` as
      `NOT NULL DEFAULT gen_random_uuid()` in the `Item` / `Risk` / `Decision`
      `CREATE TABLE`, plus the index + unique constraint. DB-level default so raw-SQL
      seeds also get a value (see design "Seed hazard").
- [ ] 1.4 `prisma migrate reset` the `_dev` and `_test` databases (MVP; pass the
      Prisma AI-consent env var) and `prisma generate`.
- [ ] 1.5 If any seed inserts item/risk/decision rows via raw SQL, confirm they
      still satisfy NOT NULL (DB default covers them); otherwise route through Prisma.

## 2. Shared schema (packages/shared)

- [ ] 2.1 Add `stableId: z.uuid()` (required) to `itemReadModelSchema`,
      `riskReadModelSchema`, `decisionReadModelSchema` in
      `packages/shared/src/schemas/section.schema.ts`.
- [ ] 2.2 Add `stableId: z.uuid().optional()` to `itemInputSchema`,
      `riskInputSchema`, `decisionInputSchema` (a new client record has none yet).
- [ ] 2.3 Update fixtures/factories that build item/risk/decision read models to
      carry `stableId`; run the schema / `report.test.ts` suites green.

## 3. API — surface stableId on the read model

- [ ] 3.1 Confirm `reportSectionFullInclude` selects `stableId` (scalar columns are
      included by default) and extend `mapPrismaToReportSection`
      (`report-sections.prisma-repository.ts`) to map `row.stableId` onto each item /
      risk / decision read model.

## 4. API — preserve stableId through saveSection

- [ ] 4.1 In `saveSection`'s `createMany` for items / risks / decisions, persist
      `stableId: <entity>.stableId` (omit when undefined so the DB default mints one
      for a brand-new record). The PK `id` stays DB-minted — do NOT reintroduce
      client-PK trust (the optimistic-lock rule).
- [ ] 4.2 Confirm the `deleteMany` → `createMany` order is unchanged and the existing
      `P2002 → BAD_REQUEST` mapping now also covers a duplicate
      `(reportSectionId, stableId)` in a malformed payload.

## 5. Carry-over — copy stableId onto the clone

- [ ] 5.1 In `cloneCarriedItem` / `cloneUnresolvedDecision`
      (`carry-over.service.ts`), keep the source record's `stableId` on the clone
      (the `...item` / `...decision` spread already carries it once the read model
      has it) while still minting a fresh PK `id`. Add an explicit assertion so a
      future refactor cannot drop it.
- [ ] 5.2 In `saveCarryOver` (`carry-over.prisma-repository.ts`), add
      `stableId: i.stableId` / `d.stableId` to the carried item / decision
      `createMany` field lists (they are not listed today).

## 6. Tests

- [ ] 6.1 Turn 0.1 green: `stableId` survives a `saveSection` round-trip; PK `id` may
      change.
- [ ] 6.2 A brand-new record saved with no `stableId` receives a stable one, and it
      is unchanged on the next save.
- [ ] 6.3 Carry-over: a carried item / decision keeps its source `stableId` (same
      lineage key) while its PK `id` differs; assert `(reportSectionId, stableId)`
      differs across the two periods.
- [ ] 6.4 Within one section, two distinct records have distinct `stableId`s (the
      `@@unique([reportSectionId, stableId])` guard holds through the recreate).

## 7. Verify

- [ ] 7.1 `pnpm --filter @customreport/api db:generate`, `pnpm typecheck`,
      `pnpm lint` until green.
- [ ] 7.2 `pnpm test` until green.
- [ ] 7.3 `openspec validate introduce-durable-record-identity --strict` until it
      exits 0.
