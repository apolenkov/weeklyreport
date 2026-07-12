## Why

Wave 0 / P0 from the 2026-07-12 repo-excellence review
(docs/reviews/repo-excellence-review-2026-07-12.md).

Two reachable `protectedProcedure` read paths on the lead form disclose more
than the caller is entitled to, on client-supplied input:

- **Head reads any lead's section across reporting-group boundaries.**
  `LeadFormService.getByPeriod` treats head as god-mode: `isHeadLike`
  short-circuits the cross-author scope gate and honours any client-supplied
  `requestedAuthorId`, then `getSectionForPeriod` does a bare
  `findUnique(reportId_authorId)` with no group filter. A head is a
  single-group role by design (`group-scope.ts`), and every sibling head
  surface (the revoke paths, the guarded repository reads) is group-scoped —
  this one is not. The `requestedAuthorId` reaches the procedure from a URL
  `searchParams` value, so a head can read a lead's full section in another
  reporting group. The `repository-scope-guard` spec declares exactly this
  cross-group read a violated invariant, and the in-code comment claiming the
  head/admin branch is "group-scoped elsewhere" is false.

- **The co-lead cross-author lens leaks the section author's whole activity
  slice.** `filterSectionToSharedProducts` scopes items, risks, decisions, and
  `projects` to the two leads' shared products, but spreads `...section`
  through, carrying `activities` and `reviews` unfiltered. `activities` carry
  per-activity status plus free-text notes; both fields are on this read model
  and populated on this path. The file's own invariant promises this byPeriod
  lens "discloses exactly what the curated Everyone lens does, never more," yet
  the Everyone lens (`CrossAuthorSectionRow`) exposes neither field. So a
  co-lead sharing a single product sees strictly more than the Everyone lens
  they are bounded to.

Both are client-triggerable confidentiality-boundary breaks. Read-only (no
write sibling), but genuine information disclosure.

## What Changes

- **Group-scope the head branch of `getByPeriod`**
  (`apps/api/src/modules/report-sections/application/lead-form.service.ts`).
  Before honouring `requestedAuthorId` for a head, assert the requested target
  section is inside the head's group via
  `groupScopeFilter(session, "reportSection")` (or an equivalent membership
  check on the target author's reporting group); reject a cross-group target
  with a 403-equivalent error. `admin` stays unconditional (`groupScopeFilter`
  returns `{}` for admin by design). A lead's own read and a genuine
  cross-author shared read are unchanged. Delete the false
  "group-scoped elsewhere" comment and replace it with the real rationale.

- **Cap the cross-author lens at the Everyone lens**
  (`apps/api/src/modules/report-sections/domain/lead-form-cross-author-scope.ts`).
  In `filterSectionToSharedProducts`, stop spreading `activities` and `reviews`
  through unfiltered: set `activities: []` and drop `reviews` (or, if a
  narrower product-scoped activity view is wanted later, filter `activities` by
  `linkedProducts ∩ sharedProductIds`) so the returned section never carries a
  field the Everyone lens (`CrossAuthorSectionRow` in `lead-form-shared.ts`)
  omits. Update the function's doc comment to state the ceiling explicitly.

- **Pin both fixes with tests** in
  `apps/api/src/modules/report-sections/application/lead-form.contract.test.ts`
  (extending the existing head no-filter read pin around lines 1060-1082): a
  head with a `requestedAuthorId` in another reporting group is rejected, an
  admin with the same input still reads, and the cross-author lens returns no
  `activities`/`reviews` for a co-lead sharing one product.

## Capabilities

### New Capabilities

- `lead-form-cross-author-scope`: the server-side cross-author (co-lead) lens
  invariant — a shared-product read never exceeds the curated Everyone lens.

### Modified Capabilities

- `repository-scope-guard`: extends the group-scope invariant to cover the
  head cross-author `getByPeriod` read path, which reaches the author-keyed
  section by `findUnique` rather than through a guarded list method.

## Impact

- `apps/api/src/modules/report-sections/application/lead-form.service.ts`
- `apps/api/src/modules/report-sections/domain/lead-form-cross-author-scope.ts`
- `apps/api/src/modules/report-sections/application/lead-form.contract.test.ts`

Non-goals: no change to the lead's own read, to a genuine cross-author shared
read's product-scoped item/risk/decision filtering, or to any write path; no
change to the web hook boundary (`lead-form-data-loading`); admin god-mode on
these reads is intentional and preserved.
