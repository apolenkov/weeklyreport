## 1. Harden `isUniqueViolation`'s scoped match

- [ ] 1.1 `apps/api/src/lib/prisma-unique-violation.ts`: replace
      `identity.includes(scope.index)` / `identity.includes(column)` with a
      word-boundary or quoted-token match (e.g. match the index/column name
      surrounded by non-identifier characters, or match against the quoted
      form Postgres/Prisma actually emits, e.g. `"Report_one_open_per_boundary"`)
- [ ] 1.2 Add a unit test: a scope whose `index` or a `columns` entry is a
      substring of an UNRELATED constraint's identity string does NOT match
      (construct a synthetic error whose `message`/`meta` contains a longer
      identifier containing the scope string as a substring)
- [ ] 1.3 Re-run every existing scoped-match test
      (`Report_one_open_per_boundary`, `ReportSection_reportId_authorId`,
      reminders' `dedupeKey`) to confirm the tightened match still accepts
      its own constraint

## 2. Guard every search chunk with `excludeTypes`

- [ ] 2.1 `apps/api/src/modules/search/search.prisma-repository.ts`: build
      `itemChunk`, `riskChunk`, `decisionChunk` the same way `projectChunk`
      already is — each wrapped in
      `excludeTypes.includes("item" | "risk" | "decision") ? Prisma.empty : Prisma.sql\`...\``
- [ ] 2.2 Update the chunk-exclusion comment (currently: "Only the project
      chunk is currently excludable") to state all four chunks are now
      uniformly guarded
- [ ] 2.3 Add/extend integration coverage in the search repository's test
      file: for each of `item`, `risk`, `decision`, `project`, assert that
      passing it in `excludeTypes` omits hits of that type from the result,
      while the other three types still surface
- [ ] 2.4 Confirm `search.service.ts`'s `resolveSearchExcludeTypes` behavior
      is unchanged (lead/viewer → `["project"]`, head/admin → `[]`) — no
      caller change needed, only the repository now honors the full contract

## 3. Gates

- [ ] 3.1 `pnpm --filter @customreport/api db:generate`
- [ ] 3.2 `pnpm --filter @customreport/api test`
- [ ] 3.3 `pnpm test:integration`
- [ ] 3.4 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 3.5 `openspec validate api-contract-matching-strictness --strict`
