## 1. Guard the product-attach race

- [x] 1.1 `admin-group-product.queries.ts`: wrap `attachProductToGroup`'s
      `create` in a catch using `isUniqueViolation` (from
      `apps/api/src/lib/prisma-unique-violation.ts`)
- [x] 1.2 On a caught unique violation, resolve to the existing row
      (idempotent re-attach) or raise `AdminGroupProductConflictError`,
      matching `upsertStageAssignmentRow`'s pattern

## 2. Guard the user-create race, preserve samlId create-only semantics

- [x] 2.1 `admin-entity-write.queries.ts`: wrap `upsertUser`'s `create`
      branch in a catch using `isUniqueViolation` on the `samlId`/email
      collision, returning a typed conflict instead of a raw 500
- [x] 2.2 Do NOT add any `samlId` write to the update branch — this is a
      deliberate non-goal (samlId is external SAML identity, create-only)
- [x] 2.3 Add a preservation test: admin edits a user's email → assert
      `samlId` on the persisted row is unchanged from before the edit

## 3. Tests

- [x] 3.1 Unit test: `attachProductToGroup` race → resolves cleanly, not a
      raw 500
- [x] 3.2 Unit test: `upsertUser` create-branch samlId/email collision →
      typed conflict, not a raw 500
- [x] 3.3 Integration test (concurrency-shaped, two racing calls): two
      concurrent `attachProductToGroup` calls for the same
      `groupId`/`productId` — exactly one persists, the other resolves
      cleanly
- [x] 3.4 Unit/integration test (task 2.3): admin email edit does not
      rewrite samlId

## 4. Spec delta

- [x] 4.1 `admin-entity-write-integrity`: ADD requirements for guarded
      product-attach and guarded user-create races, plus the samlId
      create-only invariant

## 5. Gates

- [x] 5.1 `pnpm --filter @customreport/api db:generate`
- [x] 5.2 `pnpm typecheck && pnpm lint && pnpm test`
- [x] 5.3 `cd apps/api && pnpm test:integration`
- [x] 5.4 `openspec validate admin-entity-write-integrity --strict`
