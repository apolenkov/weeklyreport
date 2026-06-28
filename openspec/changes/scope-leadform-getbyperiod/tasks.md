## 1. API: surface the shared-product set

- [ ] 1.1 Add a repository capability to return the shared-product id set for a
      viewer/author pair on a given report, reusing the co-ownership query behind
      `getCrossAuthorContent` (`apps/api/src/modules/report-sections/lead-form.prisma-repository.ts`).
- [ ] 1.2 Declare the new method on the repository interface in the service file
      so the wiring stays typed.

## 2. API: scope the cross-author read

- [ ] 2.1 In `getByPeriod` (`apps/api/src/modules/report-sections/lead-form.service.ts`),
      isolate the `lead` cross-author branch (`requestedAuthorId` present,
      `canViewOtherAuthor`, not head/admin, not own section).
- [ ] 2.2 For that branch only, fetch the shared-product id set and filter the
      returned section's `items` (current and next week), `risks`, `decisions`, and
      per-stage statuses to that set; leave the own-section and head/admin paths
      untouched.
- [ ] 2.3 Confirm `readOnly`, `canRequestReopen`, and `reopenBlockedReason`
      keep deriving from `isOwnSection` — the filter changes records only.

## 3. Contract test

- [ ] 3.1 Add a report-sections contract test: a co-lead pair sharing one
      product where the author also holds a second, unshared product; read the
      author's section as the co-lead via the service.
- [ ] 3.2 Assert unshared-product items, risks, and decisions are excluded and
      shared-product records are present.
- [ ] 3.3 Add assertions that the own-section read and a head read return the
      full section (the filter does not narrow them).

## 4. Verification

- [ ] 4.1 Run `pnpm typecheck && pnpm lint && pnpm test` and confirm the new
      contract test passes alongside the existing report-sections suite.
- [ ] 4.2 Run `openspec validate "scope-leadform-getbyperiod" --strict` and
      confirm it exits 0.
