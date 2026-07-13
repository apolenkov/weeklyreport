## 1. Group-scope the head cross-author read

- [ ] 1.1 In `lead-form.service.ts` `getByPeriod`, before honouring
      `requestedAuthorId` for a head, assert the requested target section is in
      the head's group — resolve the target author's reporting group and check
      it against `groupScopeFilter(session, "reportSection")` (or an equivalent
      membership check derived from the session's allowed group ids)
- [ ] 1.2 Reject a cross-group head target with a 403-equivalent access error
      (reuse `LeadFormAccessError` or the existing forbidden path), returning
      no section rows
- [ ] 1.3 Keep `admin` unconditional — `groupScopeFilter` returns `{}` for
      admin, so the admin branch honours `requestedAuthorId` unchanged
- [ ] 1.4 Leave the lead's own read and a genuine cross-author shared read
      (`sharedScope !== null`) unchanged
- [ ] 1.5 Delete the false "The head/admin branch is group-scoped elsewhere."
      comment; replace it with the real rationale (the head branch is now
      group-scoped here; admin is unconditional by design)

## 2. Cap the cross-author lens at the Everyone lens

- [ ] 2.1 In `lead-form-cross-author-scope.ts` `filterSectionToSharedProducts`,
      stop passing `activities` and `reviews` through the `...section` spread:
      set `activities: []` and drop `reviews` from the returned object so the
      lens carries no field the Everyone lens (`CrossAuthorSectionRow`) omits
- [ ] 2.2 Update the function's doc comment to state the ceiling explicitly:
      the shared-product lens never exposes a field beyond the curated Everyone
      lens, and `activities`/`reviews` (per-activity status + free-text notes)
      are dropped for that reason

## 3. Pin both fixes with tests

- [ ] 3.1 In `lead-form.contract.test.ts`, add a case: a head with a
      `requestedAuthorId` for a section in another reporting group is rejected
      (no rows returned)
- [ ] 3.2 Add a case: an admin with the same cross-group `requestedAuthorId`
      still reads the target section (god-mode preserved)
- [ ] 3.3 Add a case: the cross-author lens for a co-lead sharing one product
      returns empty `activities` and no `reviews`, while its shared-product
      items/risks/decisions are unchanged
- [ ] 3.4 Confirm the existing head no-filter read pin (around lines
      1060-1082) still passes for a same-group head

## 4. Gates and verification

- [ ] 4.1 `pnpm --filter @customreport/api db:generate`
- [ ] 4.2 `cd apps/api && pnpm exec vitest run src/modules/report-sections/application/lead-form.contract.test.ts`
- [ ] 4.3 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 4.4 `openspec validate close-leadform-read-leaks --strict`
