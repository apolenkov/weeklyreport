## 1. Extend `TARGET_ID_KEYS`

- [ ] 1.1 `apps/api/src/infrastructure/trpc/trpc.middleware.ts`: add
      `"userId"` and `"groupId"` to `TARGET_ID_KEYS`
- [ ] 1.2 Decide the ordering for group-product edge mutations: since
      `extractAuditTarget` returns the FIRST matching key,
      `["...", "groupId", "productId", ...]` resolves to `groupId` as the
      target, while `["...", "productId", "groupId", ...]` resolves to
      `productId`. Pick whichever side is the more useful audit target for
      `attachProductToGroup`/`detachProductFromGroup` (likely `productId` —
      the entity being attached/detached — but confirm against how other
      audit rows in the same table are queried/filtered) and place it before
      the other in the array; add `productId` too if not already covered
- [ ] 1.3 Update the array's docblock comment (the one above `TARGET_ID_KEYS`
      listing the covered id keys) to include the newly-added keys

## 2. Pin target extraction per newly-covered mutation

- [ ] 2.1 Add/extend `trpc.middleware.test.ts` (or the file's actual test
      home — confirm exact path) with cases for `deactivateUser`,
      `activateUser`, `deleteUser`: each asserts the audit row's `target`
      equals the input's `userId`
- [ ] 2.2 Add cases for `attachProductToGroup`, `detachProductFromGroup`:
      each asserts the audit row's `target` equals whichever id task 1.2
      chose as the resolved target
- [ ] 2.3 Re-run the existing `mutationAuditMiddleware` test suite to
      confirm no previously-passing case (e.g. `sectionId`/`reportId`-keyed
      mutations) regresses now that two new keys compete for the "first
      match" slot

## 3. Gates

- [ ] 3.1 `pnpm --filter @customreport/api db:generate`
- [ ] 3.2 `pnpm --filter @customreport/api test`
- [ ] 3.3 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 3.4 `openspec validate audit-target-coverage --strict`
