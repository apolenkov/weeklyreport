## Why

The report status value (`draft`/`published`) has a Zod source of truth in
`packages/shared` (`reportStatusSchema`) but no exported inferred type — so
the admin repository PORT interface imports Prisma's `ReportStatus` across
the boundary (the backlog's "repositories leak raw Prisma row types" target),
and two more files re-declare the `"draft" | "published"` union inline.
Reconnaissance plus a two-seat council confirmed the boundary is otherwise
already clean: of ~16 prisma-repositories only five touch `@prisma/client` at
all and four keep it strictly internal behind mappers.

## What Changes

- Export `type ReportStatus = z.infer<typeof reportStatusSchema>` from
  `packages/shared` (`report-primitives.schema.ts`, barrel-reachable — the
  `traffic-light-status-type` pattern).
- Swap the Prisma `ReportStatus` type import for the shared one in all three
  admin files that carry it: `admin-shared.ts` (the port — the actual leak),
  `admin-period.queries.ts`, `admin.prisma-repository.ts`. Type-only imports;
  structurally identical; zero runtime delta.
- Replace the two inline union re-declarations with the shared type:
  `archive/archive.service.ts` (`ArchiveReadFilter.status`) and
  `period/domain/period-transition.ts` (two sites — the domain zone bans
  `@prisma/client`, so the shared import is exactly the sanctioned source).
- Add `admin-shared.ts` to the existing ESLint restricted-imports block so
  the fixed port cannot regress to `@prisma/client`.
- Add a Prisma-to-shared identity test for `ReportStatus` (the
  `traffic-light-status.type.test.ts` pattern).
- Update `architecture-refactor-backlog`: record the Prisma-leak target as
  CLOSED with the corrected inventory and two named follow-ups.

Non-goals:

- No DB migration (Prisma enum already `draft`/`published`), no behavior
  change, no payload change.
- No generic `repository-domain-boundary` spec — the general port-return-type
  invariant plus its lint gate stays a NAMED follow-up (it needs wording that
  exempts the sanctioned Prisma-typed transaction applicators in
  `application/` and infrastructure internals; deferred deliberately).
- `PrismaReportSectionWithRelations` and its five `as unknown as` casts stay:
  it is the sanctioned map-at-the-boundary INPUT type (never an output);
  the cross-module cast coupling is a named follow-up.

## Capabilities

### New Capabilities

- `report-status-type`: Defines the shared report-status type contract and
  its single-literal-home rule.

### Modified Capabilities

- `architecture-refactor-backlog`: Records the repository Prisma-leak target
  as closed with corrected inventory.

## Impact

- `packages/shared`: one type export.
- `apps/api`: 5 files swapped (3 admin, 1 archive, 1 period domain), 1 new
  identity test, `eslint.config.ts` +1 path in an existing block.
- No API, database, dependency, route, or product UI behavior changes.
- Gates: `pnpm --filter @customreport/shared test`, scoped ESLint with
  `--max-warnings 0`, `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm format:check`, and OpenSpec validation.
