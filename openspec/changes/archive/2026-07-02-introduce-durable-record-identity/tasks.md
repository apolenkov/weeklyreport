## 0. Characterization test first (proves the gap)

- [x] 0.1 Real-DB integration through `saveDraft` + the repo: save a section item,
      capture its `stableId`; edit unrelated text and save again; assert the
      `stableId` is UNCHANGED across the save while the PK `id` is re-minted. Teeth
      proven by temporarily dropping `stableId` from `saveSection`'s `createMany` →
      the second save minted a new key and the test went RED, then restored to GREEN.
      (`report-sections.integration.test.ts` → "durable record identity (stableId)".)

## 1. Prisma model + migration (prisma)

- [x] 1.1 Added `stableId String @default(uuid())` to `Item`, `Risk`, `Decision`.
      App-side `@default(uuid())` (mirrors `id`) chosen over `dbgenerated` — verified
      zero raw-SQL item/risk/decision inserts exist, so the DB-level default's only
      benefit (raw-insert robustness) is moot, and app-side is drift-free.
- [x] 1.2 Added `@@index([stableId])` and `@@unique([reportSectionId, stableId])` to
      each of the three models.
- [x] 1.3 Hand-synced the single init migration SQL: `"stableId" TEXT NOT NULL`
      (no DB default — matches what Prisma generates for app-side `@default(uuid())`,
      so no drift) plus the `_stableId_idx` index and `_reportSectionId_stableId_key`
      unique constraint in each of the three `CREATE TABLE`s.
- [x] 1.4 `prisma migrate reset` applied to `_dev` and `_test` (consent env), then
      `prisma generate`. Verified in-DB: columns `NOT NULL`, unique + index present.
- [x] 1.5 No seed inserts item/risk/decision via raw SQL — seeds route through the
      Prisma client, which applies the app-side default. Re-seeded both DBs green
      (75 items each, all stableIds distinct and != PK).

## 2. Shared schema (packages/shared)

- [x] 2.1 Added `stableId: z.uuid().optional()` to `itemInputSchema`,
      `riskInputSchema`, `decisionInputSchema`. The read models (`.extend` of the
      inputs) inherit it — also **optional**, NOT required as first planned. Reason:
      `mergeSection` parses the raw save inputs against the read-model schema, so a
      required field would reject a brand-new record on its first save (design
      "Optional read model"). Presence is guaranteed by the NOT NULL column instead.
- [x] 2.2 (Folded into 2.1 — a single optional field on the inputs covers both, since
      the read models extend the inputs.)
- [x] 2.3 No fixture churn needed: because the field is optional end-to-end, existing
      fixtures/factories still parse. Web + api unit suites stayed green.

## 3. API — surface stableId on the read model

- [x] 3.1 `reportSectionFullInclude` already selects all scalar columns; extended
      `mapPrismaToReportSection` to map `row.stableId` onto each item / risk / decision
      read model, and declared `stableId?: string` on the hand-written
      `PrismaReportSectionWithRelations` row type (optional there so unit-test
      fixtures predating the column still satisfy it).

## 4. API — preserve stableId through saveSection

- [x] 4.1 `saveSection`'s `createMany` for items / risks / decisions persists
      `stableId: <entity>.stableId` (undefined omitted → the `@default(uuid())` mints
      one for a brand-new record). PK `id` stays DB-minted — client-PK trust NOT
      reintroduced.
- [x] 4.2 `deleteMany` → `createMany` order unchanged; the existing
      `P2002 → BAD_REQUEST` mapping now also covers a duplicate
      `(reportSectionId, stableId)` in a malformed payload.
- [x] 4.3 WEB (was missing from the original Impact): `sectionToDraftPayload`
      (`lead-form.tsx`) now includes `stableId` in the item / risk / decision picks so
      the round-trip is not silently dropped. Merge handlers already preserve it via
      `{ ...existing }`. Locked by a `lead-form.test.tsx` unit test (payload carries
      stableId for existing rows; undefined for a brand-new row).

## 5. Carry-over — copy stableId onto the clone

- [x] 5.1 `cloneCarriedItem` / `cloneUnresolvedDecision` keep the source `stableId`
      via the existing `...item` / `...decision` spread (the read model now carries it)
      while still minting a fresh PK `id`.
- [x] 5.2 `saveCarryOver` (`carry-over.prisma-repository.ts`) adds `stableId` to the
      carried item / decision `createMany` field lists.
- [x] 5.3 Robustness (adversarial review found two regressions the new unique key
      introduces): `CarryOverService.executeCarryOver` now skips a source item/decision
      whose `stableId` already exists in the matched target section — otherwise the item
      insert (`skipDuplicates`) orphans its `CarryOverRecord` and the decision insert
      trips P2002 misread as a dedupe race. Added `skipDuplicates: true` to the decision
      insert too (defense-in-depth). Covered by a service test (duplicate lineage is not
      re-carried: count 0, no records, no target duplicate). See design "Carry-over must
      not re-carry a lineage the target already holds".

## 6. Tests

- [x] 6.1 stableId survives a `saveSection` round-trip; PK `id` may change.
- [x] 6.2 A brand-new record saved with no `stableId` receives a stable one, unchanged
      on the next save; and it round-trips through the full `saveDraft` service path
      (guards the OPTIONAL read model — mergeSection must not reject the new record).
- [x] 6.3 Carry-over: a carried item keeps its source `stableId` (same lineage key)
      while its PK `id` differs (`carry-over.integration.test.ts`).
- [x] 6.4 Within one section, two distinct records have distinct `stableId`s and the
      `@@unique([reportSectionId, stableId])` guard holds through the delete-recreate.

## 7. Verify

- [x] 7.1 `db:generate`, `pnpm typecheck` (5/5), `pnpm lint` (clean).
- [x] 7.2 `pnpm test` (unit, all packages green) + `pnpm --filter @customreport/api
test:integration` (231 passed, 2 skipped).
- [x] 7.3 `openspec validate introduce-durable-record-identity --strict` exits 0.
