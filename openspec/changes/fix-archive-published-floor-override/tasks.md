## 1. Fix the floor-override inversion

- [ ] 1.1 `apps/api/src/modules/archive/archive.prisma-repository.ts:70`
      (`listArchiveReports`): change
      `const where = { ...PUBLISHED_FLOOR, ...filter };` to
      `const where = { ...filter, ...PUBLISHED_FLOOR };` so the floor is
      spread last and cannot be overridden by `filter.status`
- [ ] 1.2 `apps/api/src/modules/archive/archive.prisma-repository.ts:173`
      (`getArchiveReport`): change
      `where: { id: reportId, ...PUBLISHED_FLOOR, ...filter }` to
      `where: { id: reportId, ...filter, ...PUBLISHED_FLOOR }` for the
      same reason
- [ ] 1.3 Re-read the `PUBLISHED_FLOOR` doc comment
      (`archive.prisma-repository.ts:28-42`) and confirm it still
      accurately describes the (now-true) behavior; no wording change
      expected since it already documents the intended guarantee

## 2. Spec delta

- [ ] 2.1 `openspec/specs/archive-published-floor/spec.md` (new
      capability): ADD a requirement that both archive read call sites
      MUST spread the published-only floor after any caller-supplied
      filter, with a scenario covering a mis-built filter that attempts
      to widen visibility to non-published reports

## 3. Tests

- [ ] 3.1 `archive.prisma-repository.test.ts` (or nearest unit suite for
      this repository) — add a case for `listArchiveReports`: a filter of
      `{ status: "draft" }` still produces a `where` whose `status` is
      `"published"` (assert the effective Prisma `where` argument, e.g.
      via a mocked `PrismaService.report.findMany` call)
- [ ] 3.2 Same suite, `getArchiveReport`: a filter of `{ status: "draft"
}` still produces a `where` whose `status` is `"published"`
- [ ] 3.3 `archive.integration.test.ts`: a regression case exercising
      `listArchiveReports`/`getArchiveReport` with a manually constructed
      `filter = { status: "draft" }` (bypassing `buildArchiveReadFilter`)
      against a seeded non-published report — confirm the report is NOT
      returned
- [ ] 3.4 Confirm existing archive tests
      (`archive.integration.test.ts`, `archive.service.test.ts`,
      `archive.contract.test.ts`) stay green — no behavior change for any
      current caller

## 4. Gates and verification

- [ ] 4.1 `pnpm --filter @customreport/api db:generate`
- [ ] 4.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 4.3 `openspec validate fix-archive-published-floor-override --strict`
- [ ] 4.4 Adversarial review of the diff before archiving
