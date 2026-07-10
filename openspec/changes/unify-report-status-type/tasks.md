## 1. Shared foundation

- [ ] 1.1 Export `type ReportStatus = z.infer<typeof reportStatusSchema>`
      beside the schema in `report-primitives.schema.ts`.

## 2. Api swap

- [ ] 2.1 Swap the Prisma `ReportStatus` type import for the shared one in
      `admin-shared.ts` (the port), `admin-period.queries.ts`, and
      `admin.prisma-repository.ts` — type-only, operands untouched.
- [ ] 2.2 Replace the inline `"draft" | "published"` unions with the shared
      type in `archive/archive.service.ts` (filter) and
      `period/domain/period-transition.ts` (two sites; domain zone stays
      Prisma-free by construction).
- [ ] 2.3 Add `admin-shared.ts` to the existing ESLint restricted-imports
      files array so the fixed port cannot regress.
- [ ] 2.4 Add the Prisma-to-shared identity test for `ReportStatus`
      (expectTypeOf pattern, placed with the admin module's tests).

## 3. Verification

- [ ] 3.1 Repo grep: the two-literal union appears nowhere in workspace
      source outside `report-primitives.schema.ts` (both literal orders and
      `z.enum` forms).
- [ ] 3.2 Update `openspec/specs/architecture-refactor-backlog/spec.md` and
      the matching change delta: target CLOSED with corrected inventory and
      the two named follow-ups.
- [ ] 3.3 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`,
      and `git diff --check`, then validate this change with `--strict` and
      run the full strict OpenSpec validation.
