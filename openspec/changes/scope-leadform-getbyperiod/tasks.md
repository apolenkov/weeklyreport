## 1. API: surface the shared-product set

- [ ] 1.1 Add a repository capability to return the shared NON-ARCHIVED
      product id set for a viewer/author pair on a given report, reusing the
      co-ownership query behind `getCrossAuthorContent` (which filters
      `project: { archived: false }`)
      (`apps/api/src/modules/report-sections/lead-form.prisma-repository.ts`).
      This one set drives BOTH the authorization gate and the content filter.
- [ ] 1.2 Declare the new method on the repository interface in the service file
      so the wiring stays typed.

## 2. API: scope the cross-author read

- [ ] 2.1 In `getByPeriod` (`apps/api/src/modules/report-sections/lead-form.service.ts`),
      replace the `lead` cross-author gate: stop using `hasSharedProduct` (which
      counts archived products) and instead gate on the shared NON-ARCHIVED set
      from 1.1. When that set is empty, fall back to the viewer's own section (the
      existing `sectionAuthorId = userId` path) — no foreign status or metadata.
      Leave the head/admin branch untouched.
- [ ] 2.2 For the `lead` cross-author branch only, filter the returned section's
      `items` (current and next week), `risks`, `decisions`, per-stage statuses,
      the `projects` array (drop entries for unshared products, including their
      `projectName`/`trafficLight`/`ownedStages`/`stageSet`), and recompute
      `referencedProjects` from the filtered rows — all to the shared set; leave
      the own-section and head/admin paths untouched.
- [ ] 2.3 Confirm `readOnly`, `canRequestReopen`, and `reopenBlockedReason`
      keep deriving from `isOwnSection` — the filter changes records only.

## 3. Contract test

- [ ] 3.1 Add a report-sections contract test: a co-lead pair sharing one
      product where the author also holds a second, unshared product; read the
      author's section as the co-lead via the service.
- [ ] 3.2 Assert unshared-product items, risks, and decisions are excluded and
      shared-product records are present. ALSO assert the unshared product is
      absent from the `projects` array (no `projectId`/`projectName`/`trafficLight`,
      no `ownedStages`, no `stageSet`) and from `referencedProjects`, while the
      shared product's card and stage data remain.
- [ ] 3.3 Add assertions that the own-section read and a head read return the
      full section (the filter does not narrow them).
- [ ] 3.4 Add a case where the pair shares ONLY an archived product: assert the
      cross-author read is denied and falls back to the viewer's own section
      (no foreign section status or metadata is returned).

## 4. Verification

- [ ] 4.1 Run `pnpm typecheck && pnpm lint && pnpm test` and confirm the new
      contract test passes alongside the existing report-sections suite.
- [ ] 4.2 Run `openspec validate "scope-leadform-getbyperiod" --strict` and
      confirm it exits 0.
