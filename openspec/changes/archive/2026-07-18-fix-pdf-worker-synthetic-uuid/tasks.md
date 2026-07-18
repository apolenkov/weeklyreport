# Tasks

## 1. Characterization pin (current behavior, before the fix)

- [ ] 1.1 Add a regression test that parses the CURRENT
      `buildLegacyPdfExportSession(...)` output through `userSessionSchema`
      and asserts it currently FAILS (`safeParse(...).success === false`),
      pinning the bug's existence before it is fixed.

## 2. Fix the synthetic UUID

- [ ] 2.1 In `apps/api/src/infrastructure/trpc/trpc.context.ts`, replace
      `PDF_EXPORT_SYNTHETIC_USER_ID = "a0000000-0000-4000-8000-0000000pdfwk"`
      with a valid all-hex UUID following the file's existing
      `a0000000-0000-4000-8000-...` synthetic-id convention.
- [ ] 2.2 Update the hardcoded duplicate literal in
      `apps/api/src/infrastructure/trpc/trpc.context.pdf-export.test.ts:456`
      to the same new UUID value.

## 3. Flip the pin to a positive regression test

- [ ] 3.1 Update the test from Task 1 to assert `safeParse(...).success ===
true` against the new UUID, locking in that the legacy PDF-export
      session now satisfies `userSessionSchema` as its docblock claims.

## Gates

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm --filter @customreport/api test:integration`
