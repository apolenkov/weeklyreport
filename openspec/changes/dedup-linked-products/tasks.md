## 1. Schema-boundary dedup (the actual fix)

- [ ] 1.1 `packages/shared/src/schemas/project-activity.schema.ts`: add a
      `.refine((ids) => new Set(ids).size === ids.length, { message: "linkedProductIds must not contain duplicates" })`
      to the `linkedProductIds` field on `projectActivityCreateSchema` and
      `projectActivityUpdateSchema`
- [ ] 1.2 `packages/shared/src/schemas/project-activity.test.ts`: add a case
      per schema asserting a `linkedProductIds` array with a repeated id fails
      parsing with the duplicate-ids message, and a case confirming a unique
      array of the same length still passes

## 2. Repository defense-in-depth

- [ ] 2.1 `project-activity.prisma-repository.ts` `create`: dedupe
      `linkedProductIds` (e.g. `[...new Set(linkedProductIds)]`) before
      mapping to `activityProducts.create`
- [ ] 2.2 `project-activity.prisma-repository.ts` `update`: add
      `skipDuplicates: true` to the `projectActivityProduct.createMany` call
      in the `toAdd` branch
- [ ] 2.3 `project-activity.service.test.ts` (or the repository's own test, if
      one exists): add a case that calls `create`/`update` with a
      programmatically-duplicated `linkedProductIds` array (bypassing the Zod
      schema, simulating a non-web caller) and asserts no `P2002` escapes and
      the resulting `linkedProducts` has no duplicate entries

## 3. Spec delta

- [ ] 3.1 `activity-reporting-unit`: ADD a requirement that duplicate ids in
      `linkedProductIds` are rejected as a clean validation error, not an
      unhandled Prisma error

## 4. Verification

- [ ] 4.1 `pnpm --filter @customreport/api db:generate`
- [ ] 4.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 4.3 Manual/integration check: submit a `projectActivity.create` tRPC
      call with a repeated id in `linkedProductIds` (e.g. via
      `project-activity.integration.test.ts`) and confirm it now returns
      `BAD_REQUEST` with the duplicate-ids message, not `INTERNAL_SERVER_ERROR`
- [ ] 4.4 `npx openspec validate dedup-linked-products --strict`
