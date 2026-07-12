## 1. Complete the wipe delete map

- [ ] 1.1 In `prisma/wipe-manual-uat.ts`, add four deletes to the transactional
      `CountMap`, positioned after the report-section content deletes
      (`reportSection`) and before `project` and `reportingGroup`, in this
      FK-safe order: `activityStatus` → `projectActivityLead` →
      `projectActivityProduct` → `projectActivity`. Use the same
      `(await tx.<model>.deleteMany({})).count` shape as the surrounding entries
- [ ] 1.2 Add a short comment explaining the ordering rationale (statuses
      reference their activity; `ProjectActivity.groupId` and
      `ProjectActivityProduct.productId` are `RESTRICT`, so activities must drop
      before `reportingGroup`/`project`) — WHY only, no ticket or phase tags
- [ ] 1.3 Confirm the delete order matches the sibling pattern in
      `prisma/seed-simple.ts` (the four activity deletes there sit before the
      `reportingGroup`/`project` deletes)

## 2. Gates and verification

- [ ] 2.1 `pnpm --filter @customreport/api db:generate`
- [ ] 2.2 `pnpm typecheck && pnpm lint` — both green
- [ ] 2.3 Provision a disposable dev DB with the standard seed (`prisma migrate reset` then `pnpm db:seed:simple`), confirming it contains activity rows
- [ ] 2.4 Run the manual-UAT wipe against that DB (`pnpm --dir apps/api exec tsx ../../prisma/wipe-manual-uat.ts`) and confirm it completes without an FK violation and the reseeded Demo baseline is present
- [ ] 2.5 `openspec validate fix-wipe-uat-activity-tables --strict`
