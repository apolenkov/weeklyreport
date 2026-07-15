## 1. Deterministic ordering in the snapshot include

- [x] 1.1 `published-report-snapshot.ts`: add `orderBy` on the `sections`
      relation in `reportFullIncludeForSnapshot`, matching
      `compareSections`'s author-name ordering as closely as Prisma's
      relation `orderBy` allows
- [x] 1.2 Check `weekly-report.prisma-repository.ts` for an independent
      section query bypassing this shared include; if found, apply the same
      `orderBy` there
- [x] 1.3 If DB-level collation cannot fully replicate `localeCompare("ru")`,
      document the residual gap in a code comment at the `orderBy` site —
      do not add a second application-level sort as a workaround

## 2. Tests

- [x] 2.1 `publication.service.test.ts`: assert snapshot section order
      matches `compareSections`'s ordering for a fixed multi-author input.
      COVERED DIFFERENTLY: the existing Russian-locale `compareSections`
      test already pins the in-memory ordering, and a mocked-repository unit
      test cannot exercise the Prisma-level `orderBy` this change adds — the
      DB-order proof lives in the 2.2 integration test instead.
- [x] 2.2 Integration test: seed a report with sections from 3+ authors in
      non-alphabetical creation order; fetch the frozen snapshot; assert
      order matches author-name ordering and is stable across repeated reads

## 3. Spec delta

- [x] 3.1 `published-section-order-determinism`: ADD the requirement that
      the durable snapshot's section order is deterministic and matches the
      live-preview ordering

## 4. Gates

- [x] 4.1 `pnpm --filter @customreport/api db:generate`
- [x] 4.2 `pnpm typecheck && pnpm lint && pnpm test`
- [x] 4.3 `cd apps/api && pnpm test:integration`
- [x] 4.4 `openspec validate published-section-order-determinism --strict`
