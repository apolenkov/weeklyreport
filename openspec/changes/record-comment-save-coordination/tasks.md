## 1. Coordinate the write path

- [ ] 1.1 `review-actions.prisma-repository.ts`: wrap anchor resolution +
      `prisma.recordComment.create` in a single `$transaction`
- [ ] 1.2 Inside that transaction, either take the same `Report` row `FOR
UPDATE` lock `saveSection` takes, or perform a `ReportSection.version`
      compare-and-set against the version the caller last saw
- [ ] 1.3 Resolve the anchor by the record's stableId lineage instead of the
      raw PK, matching `captureRecordComments`'s lookup strategy
- [ ] 1.4 Catch Prisma `P2003` around the comment insert and return a typed
      conflict/not-found error instead of letting it surface raw

## 2. Tests

- [ ] 2.1 Unit test: `insertComment` on a deleted/nonexistent anchor PK
      returns the typed error, not a thrown `P2003`
- [ ] 2.2 Unit test: anchor resolution follows stableId, not raw PK, when
      the two differ (post-recreate)
- [ ] 2.3 Integration test (concurrency-shaped, two racing calls): a
      `saveSection` paused between capture and delete-recreate races an
      `insertComment` on the same record — assert the comment is preserved
      or a typed conflict is returned, never silently dropped or a raw 500
- [ ] 2.4 Integration test (concurrency-shaped): `insertComment` against a
      PK a completed `saveSection` already deleted — assert typed
      conflict/not-found, not unhandled `P2003`

## 3. Spec delta

- [ ] 3.1 `record-comment-save-coordination`: ADD requirements for
      transactional anchor+insert coordination, stableId anchoring, and
      P2003 handling

## 4. Gates

- [ ] 4.1 `pnpm --filter @customreport/api db:generate`
- [ ] 4.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 4.3 `cd apps/api && pnpm test:integration`
- [ ] 4.4 `openspec validate record-comment-save-coordination --strict`
