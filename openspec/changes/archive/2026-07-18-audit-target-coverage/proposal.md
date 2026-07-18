## Why

BL-29 (P1 per the review's own severity table / P2 per its "Orchestrator
amendments" restoration note — the amendments section explicitly restores
this finding after its verify agent died mid-run and hand-verifies it;
task brief classifies it under the P2/P3 tail, so filed here at that bar),
`docs/reviews/repo-excellence-review-2026-07-14.md`, "Orchestrator
amendments" section (NORMATIVE): `TARGET_ID_KEYS` in
`apps/api/src/infrastructure/trpc/trpc.middleware.ts` is
`["sectionId", "reportId", "periodId", "projectId", "leadId", "id"]` — it has
no `userId` or `groupId` entry, and `productId` only appears paired with
`groupId` on group-product edge mutations (never alone). `extractAuditTarget`
scans the raw mutation input for the first key in `TARGET_ID_KEYS` present as
a string; when a mutation's input has none of those keys, `mutationAuditMiddleware`
writes its audit row with `target: undefined`. Confirmed against source:
`deactivateUser`/`activateUser`/`deleteUser`
(`apps/api/src/infrastructure/trpc/routers/admin/users.procedures.ts`) all
take `{ userId: z.uuid() }` — none of the current key names match, so
user-lifecycle audit rows carry no target. `attachProductToGroup`/
`detachProductFromGroup`
(`apps/api/src/infrastructure/trpc/routers/admin/catalog.procedures.ts`) take
`groupProductEdgeInputSchema` = `{ groupId, productId }` — again no match, so
group-product edge audit rows carry no target either.

## What Changes

- `apps/api/src/infrastructure/trpc/trpc.middleware.ts`: extend
  `TARGET_ID_KEYS` to include `userId` and `groupId` (and confirm `productId`
  is already effectively covered once `groupId` is added — a group-product
  edge mutation will resolve to `groupId` as its target since
  `extractAuditTarget` returns the FIRST matching key; add `productId` too if
  a per-mutation single target of "the product side" is preferred over
  "the group side" — see task 1 for the exact ordering decision).
- Add a test that pins target extraction for each of the five newly-covered
  mutations (`deactivateUser`, `activateUser`, `deleteUser`,
  `attachProductToGroup`, `detachProductFromGroup`), asserting the audit row
  written by `mutationAuditMiddleware` carries a non-undefined `target`
  matching the expected id.

## Claim disposition

| Claim                                                                        | Verdict                                                                                                                                                                                                                          | Action                                            |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `TARGET_ID_KEYS` lacks `userId`/`groupId`/`productId`                        | CONFIRMED — read `trpc.middleware.ts:258-265`; the array is exactly `["sectionId", "reportId", "periodId", "projectId", "leadId", "id"]`                                                                                         | Extend the key list                               |
| `deactivateUser`/`activateUser`/`deleteUser` write audit rows with no target | CONFIRMED — read `users.procedures.ts`; all three take `{ userId: z.uuid() }` as their sole input shape, and `userId` is absent from `TARGET_ID_KEYS`                                                                            | Add `userId`                                      |
| Group-product edge mutations write audit rows with no target                 | CONFIRMED — read `catalog.procedures.ts:130-144`; `attachProductToGroup`/`detachProductFromGroup` both take `groupProductEdgeInputSchema` = `{ groupId: z.uuid(), productId: z.uuid() }`, and neither key is in `TARGET_ID_KEYS` | Add `groupId` (and decide on `productId`, task 1) |

## Non-goals

- Not changing `extractAuditTarget`'s single-target "first match wins"
  design to a multi-target array — out of scope; this change only adds
  missing keys to the existing single-target list.
- Not adding before/after diff capture to the audit middleware — explicitly
  deferred per the middleware's own docblock ("Prisma-side introspection is
  deferred to a future phase").
- Not auditing every other admin mutation for a similarly-missing key beyond
  the two families the review named (user-lifecycle, group-product edge) —
  if implementation turns up a third family sharing the same gap, note it
  but keep this change scoped to the two confirmed families; file a follow-up
  if more surface.

## File manifest

- `apps/api/src/infrastructure/trpc/trpc.middleware.ts` — `TARGET_ID_KEYS`
  (line 258)
- `apps/api/src/infrastructure/trpc/trpc.middleware.test.ts` (extend
  existing coverage, or create if the middleware has no dedicated test file
  — confirm during implementation)

## Verification

P2 contract bar: full gate + affected unit/integration suites (this is an
authz/observability-adjacent audit-trail fix, treated at the stricter P2
contract bar given its security-relevant nature, not the looser P3 bar).

- `pnpm --filter @customreport/api db:generate`
- `pnpm --filter @customreport/api test`
- `pnpm typecheck && pnpm lint && pnpm test`
- `openspec validate audit-target-coverage --strict`

## Sequencing

Independent of the other five changes — touches only
`trpc.middleware.ts`, which none of the other five changes modify.
