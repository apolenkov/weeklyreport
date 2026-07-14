## Why

BL-21, P1, `docs/reviews/repo-excellence-review-2026-07-14.md`.

`telemetry.service.ts`'s `getSummary` (~lines 65-90) returns org-wide
aggregate KPIs (reports/active-leads/late-sections/pending-reopens) with no
group scoping at all — confirmed by grep: zero references to `session`,
`groupScopeFilter`, or `guardGroupScope` anywhere in
`apps/api/src/modules/telemetry/`. It is exposed via `leadershipProcedure`
to group-restricted head and subset-access viewer roles, unlike the sibling
`analytics` module (`analytics.prisma-repository.ts`), where every method
does `guardGroupScope(session); const scope = groupScopeFilter(session,
"reportSection");` before querying. A single-group head or a
subset-access viewer currently receives cross-group aggregate counts.

Separately, `weekly-report.service.ts`'s `resolveDefaultReportId`
(167-180) has an explicit asymmetry:

```ts
if (role === "viewer") {
  return (
    (await this.repository.getCurrentEditableId()) ??
    (await this.repository.getLatestPublishedId())
  );
}
if (role === "head") {
  return (
    (await this.repository.getCurrentEditableId()) ??
    (await this.repository.getLatestPublishedNonArchivedId())
  );
}
```

The viewer fallback calls `getLatestPublishedId()` (no archived filter, no
visibility scope), while head calls `getLatestPublishedNonArchivedId()`.
Confirmed via `weekly-report.prisma-repository.ts:56,60` — both methods
exist and differ exactly as described; the viewer's landing default can
resolve to an archived report that head's own landing logic would skip.

## What Changes

- Thread `session` into `telemetry.service.ts`'s `getSummary` (and any
  other repository query it calls) and apply `guardGroupScope` +
  `groupScopeFilter` the same way `analytics.prisma-repository.ts` does, so
  a group-restricted head or viewer gets counts scoped to their accessible
  groups, not the whole org. Add the scope discriminator to the telemetry
  cache key (if the summary is cached) so a cross-group cache collision
  can't leak one group's aggregate into another's response.
- If, on review, the telemetry card is deliberately meant to be org-wide
  (a department-level dashboard), the alternative resolution is to gate it
  to admin/department-head only and document the exemption explicitly in
  the service — but the default assumption per the review is to scope it
  like `analytics`.
- Switch the viewer branch of `resolveDefaultReportId` to call
  `getLatestPublishedNonArchivedId()` instead of `getLatestPublishedId()`,
  matching head's resolver, so the viewer landing default cannot be an
  archived report.

## Claim disposition

| Claim (review doc)                                                                                                        | Disposition                  | Note                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Telemetry summary has no group scoping                                                                                    | CONFIRMED                    | Grep of `apps/api/src/modules/telemetry/` shows zero `session`/`groupScopeFilter`/`guardGroupScope` references; `analytics.prisma-repository.ts` uses both patterns at every query site.                                                                                                                                          |
| Viewer fallback uses unscoped `getLatestPublishedId` vs head's `getLatestPublishedNonArchivedId`                          | CONFIRMED                    | `weekly-report.service.ts:171,177`; both repository methods exist and differ exactly as claimed (`weekly-report.prisma-repository.ts:56,60`).                                                                                                                                                                                     |
| `requestPdfExport` lacks a group-scope check                                                                              | OUT OF SCOPE for this change | Review doc itself notes this is "tracked in BL-13" (`pdf-export-backend-lifecycle`) — not duplicated here.                                                                                                                                                                                                                        |
| BL-29 (council/GLM) head cross-group archive/unarchive IDOR — "no group-scope on client reportId" for lifecycle mutations | **REJECTED / Non-goal**      | Per the review doc's own "Orchestrator amendments": head lifecycle authz guards (archive/unarchive scope checks) were explicitly declined as a product decision (2026-07, recorded) — not a defect. Any sub-finding proposing head-scope guards on lifecycle _mutations_ (archive/unarchive) is out of scope here; see Non-goals. |

## Non-goals

- **No group-scope guard added to `archive.router.ts` / `archivePeriod` /
  `unarchivePeriod` or any other head lifecycle mutation.** This was a
  council-reported miss (glm, REJECTED in the review's amendments — not to be
  confused with BL-29, the audit-target finding) and the guard it proposes
  is a declined product decision, not a gap — cross-group
  archive/unarchive by head is intentional. This change touches only
  _telemetry_ (read/aggregate) and the _viewer report-fallback resolver_
  (read), matching the review's own scoping: "group-scope gaps for
  telemetry/viewer/PDF read surfaces remain in scope."
- Not touching `requestPdfExport`'s scope check — tracked separately under
  `pdf-export-backend-lifecycle` (BL-13).
- Not re-deciding whether telemetry _should_ be org-wide vs group-scoped as
  a product question — this change defaults to scoping it (matching
  `analytics`) but flags the admin-exemption alternative for review sign-off
  before implementation, per "What Changes" above.

## File manifest

- `apps/api/src/modules/telemetry/telemetry.service.ts` — `getSummary`
  (~65-90): thread `session`, apply `guardGroupScope`/`groupScopeFilter`.
- `apps/api/src/modules/analytics/analytics.prisma-repository.ts` —
  read-only reference for the `guardGroupScope`/`groupScopeFilter` pattern
  (lines 14, 41, 47, 106-107, 159-160); no change.
- `apps/api/src/modules/weekly-report/weekly-report.service.ts` —
  `resolveDefaultReportId` (167-180): viewer branch calls
  `getLatestPublishedNonArchivedId()` instead of `getLatestPublishedId()`.
- `apps/api/src/modules/telemetry/telemetry.service.test.ts`,
  `apps/api/src/modules/telemetry/telemetry.gauges.test.ts` — add
  group-scope assertions (currently no group-scope test exists).
- `apps/api/src/modules/weekly-report/weekly-report.service.test.ts` — add
  a test for the viewer-branch resolver change.
- `apps/api/src/modules/weekly-report/weekly-report.latest-published-non-archived.integration.test.ts`
  — extend or sibling with a viewer-role case (currently appears to cover
  only head's non-archived path).

## Verification

- `pnpm --filter @customreport/api db:generate && pnpm typecheck && pnpm lint && pnpm test`
- `cd apps/api && pnpm test:integration` — required: group-scope filtering
  against real seeded multi-group data, and the viewer-fallback resolver
  against a real archived-report row.
- Unit test: `telemetry.getSummary` called with a session scoped to group A
  returns counts excluding group B's reports/sections.
- Integration test: seed reports in two groups; a group-A-scoped head's
  telemetry summary excludes group-B counts.
- Integration test: seed an archived published report as the only published
  report for a group; a viewer in that group's `resolveDefaultReportId`
  does not resolve to the archived report (matches head's existing
  behavior for the equivalent seed).

## Sequencing

No ordering dependency on other P1 changes in this batch. Does not touch
`archive.router.ts`, `admin.service.ts`, or `period-admin.service.ts` (the
BL-29 files) — those remain untouched per the Non-goals above. Independent
of `session-hydration-error-scoping`, `record-comment-save-coordination`,
`admin-entity-write-integrity`, and `published-section-order-determinism`
(no shared files).
