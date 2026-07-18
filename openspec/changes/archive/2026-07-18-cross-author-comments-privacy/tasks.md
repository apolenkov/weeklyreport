## 1. Strip comments in the shared-product filter

- [x] 1.1 In `filterSectionToSharedProducts`
      (`lead-form-cross-author-scope.ts`), map the retained `items`, `risks`,
      and `decisions` arrays to omit each row's optional `comments` field.
- [x] 1.2 Update the function's docblock (lines 119-138) if the comment-
      stripping mechanism description needs a line for the new field, so the
      "ceiling" claim stays accurate to the code.
- [x] 1.3 Confirm `referencedProjects` recomputation (lines 163-170) is
      unaffected — it depends only on `projectId`/`productId`, not on
      `comments`.

## 2. Test coverage

- [x] 2.1 Add a unit test for `filterSectionToSharedProducts` (create the
      test file if none exists) asserting: given a section with items,
      risks, and decisions on a shared product each carrying a non-empty
      `comments[]`, the filtered output has no `comments` on any retained
      record.
- [x] 2.2 Test: product-scoping is unchanged — a record on a non-shared
      product is still dropped entirely (not just comment-stripped).
- [x] 2.3 Test: `activities` is still emptied and `reviews` is still absent,
      confirming this change did not regress the existing stripping.
- [x] 2.4 If `lead-form.service.ts` has (or gets) a test covering
      `getByPeriod`'s cross-author path, add/confirm an assertion that the
      returned section carries no `comments` anywhere.

## 3. Spec delta

- [x] 3.1 `lead-form-cross-author-scope`: MODIFY the requirement
      "Cross-Author Lens Never Exceeds the Everyone Lens" to name `comments`
      alongside `activities`/`reviews` as a field the shared-product lens
      MUST NOT carry (see `specs/lead-form-cross-author-scope/spec.md` in
      this change).

## 4. Gates and verification

- [x] 4.1 `pnpm --filter @customreport/api db:generate`
- [x] 4.2 `pnpm typecheck && pnpm lint && pnpm test`
- [x] 4.3 cd apps/api && pnpm test:integration
- [x] 4.4 `openspec validate cross-author-comments-privacy --strict`
