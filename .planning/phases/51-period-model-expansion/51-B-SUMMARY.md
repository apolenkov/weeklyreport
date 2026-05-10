---
phase: 51
plan: 51-B
subsystem: web + api (admin Periods tab + lifecycle list/archive surface)
tags: [UFB-052, admin-periods-tab, period-lifecycle, reopen-policy-gate]
requires: [51-A, 51-C]
provides:
  [
    admin.listPeriodsByState query,
    admin.archivePeriod / admin.unarchivePeriod mutations,
    PeriodService reopen-policy gate (51-A knobs wired),
    lifecycle-aware Admin Periods tab (Active / Archive split),
  ]
affects:
  [
    packages/shared/src/schemas/report.ts,
    apps/api/src/modules/admin/admin.service.ts,
    apps/api/src/modules/admin/admin.prisma-repository.ts,
    apps/api/src/modules/period/period.service.ts,
    apps/api/src/modules/period/period.module.ts,
    apps/api/src/infrastructure/trpc/trpc.router.ts,
    apps/web/src/components/admin/periods-tab.tsx,
    apps/web/src/components/admin/admin-panel.tsx,
    apps/web/src/components/admin/admin-tabs-mobile-select.tsx,
    apps/web/src/app/(app)/admin/page.tsx,
  ]
tech_added: []
key_files_created:
  - apps/web/src/components/admin/periods-tab.test.tsx
key_files_modified:
  - packages/shared/src/schemas/report.ts
  - packages/shared/src/schemas/__tests__/report.test.ts
  - apps/api/src/modules/admin/admin.service.ts
  - apps/api/src/modules/admin/admin.service.test.ts
  - apps/api/src/modules/admin/admin.prisma-repository.ts
  - apps/api/src/modules/period/period.service.ts
  - apps/api/src/modules/period/period.service.test.ts
  - apps/api/src/modules/period/period.module.ts
  - apps/api/src/infrastructure/trpc/trpc.router.ts
  - apps/web/src/components/admin/periods-tab.tsx
  - apps/web/src/components/admin/admin-panel.tsx
  - apps/web/src/components/admin/admin-tabs-mobile-select.tsx
  - apps/web/src/app/(app)/admin/page.tsx
decisions:
  - "Scope reduction: followed the orchestrator prompt's three mutations (archive / unarchive / list) instead of the PLAN.md's six (updateDeadline, addNote, deletePeriod, rePublishPDF, …). Rationale: 2–3h budget + four of the PLAN.md actions overlap existing surfaces or would require new domain primitives."
  - "Reused existing `period.publish` / `period.reopen` (headProcedure) for the Publish/Reopen menu items instead of wrapping them in `admin.*` aliases. Admin role is aliased to head at the procedure level, so the existing surface is callable from the admin tab without re-exposing the same logic twice."
  - "Added `admin.listPeriodsByState` as a fresh richer-payload endpoint rather than extending `reportPeriodSchema`. Two reasons: (a) extending the snapshot schema would touch every admin-snapshot consumer; (b) the new shape carries `submittedCount / totalCount / canReopen / canArchive`, which are dashboard-tab-specific."
  - "Server precomputes `canReopen` / `canArchive` from `AppSettings.allowReopenAfterPublish` + `reopenWindowHours`. UI does not replicate the policy rules — keeps a single source of truth."
  - "Active bucket fans out to `{ scheduled, open, published }`; the UI then uses `canReopen` to hint which published rows are still actionable. If 51-D wants strict server-side bucketing (`published-out-of-window` → archive bucket), the bucket resolver is the seam."
  - "PeriodService gained a `ReopenPolicyReader` lambda with `null = no-gate` default so 88+ pre-51-B unit / integration tests keep passing. Production wiring resolves to `AppSettings.allowReopenAfterPublish` + `reopenWindowHours` (51-A knobs)."
  - "Discovered mid-implementation: the old PeriodsTab was dead code — never mounted in `/admin/page.tsx` (the snapshot path silently fell back to UsersTab). Wiring the tab into the nav was an implicit assumption of both the PLAN.md and the prompt; absorbed as Rule 3 work."
  - "`unarchivePeriod` derives the next `periodState` from the legacy `(status, periodStatus)` tuple at write time. The scheduled-vs-open distinction is lost across an archive round-trip; documented as acceptable since manual archive of a SCHEDULED row is an edge case (the PeriodCreator scheduler re-mints anyway)."
  - "Skipped the 'force-open SCHEDULED period' UI per the orchestrator advisor recommendation — the auto-creator already flips scheduled→open daily. Documented as open question."
metrics:
  duration_min: 28
  tasks_completed: 3
  files_created: 1
  files_modified: 13
  commits: 3
  shared_tests: 494 # +12 from 482 baseline (11 bucket/row tests; 1 it.each enumeration)
  api_unit_tests: 823 # +15 from 808 baseline (11 admin.service + 4 period.service)
  api_integration_tests: 66 # unchanged
  web_tests: 333 # +11 from 322 baseline (PeriodsTab RTL coverage)
completed: 2026-05-11
---

# Phase 51 Plan B: Admin Periods Tab redesign Summary

**One-liner:** Replaced the dead flat-list `PeriodsTab` with a lifecycle-aware Active/Archive layout backed by new admin surfaces (`listPeriodsByState`, `archivePeriod`, `unarchivePeriod`), wired the 51-A reopen-policy knobs (`allowReopenAfterPublish`, `reopenWindowHours`) into `PeriodService.reopenPeriod` as a server-side gate, and discovered & fixed that the tab had never been mounted in the admin nav.

## What was built

**Shared zod (commit `c882e49`).** Two new schemas:

- `periodListBucketSchema = z.enum(['active', 'archive', 'scheduled', 'open', 'published', 'archived'])` — input contract for the new admin query. `'active'` and `'archive'` are virtual buckets that fan out at the service layer; the four `PeriodState` values pass through unchanged for callers that already know the precise state they want.
- `periodListItemSchema` — row shape carrying everything the new admin tab renders without a second round-trip: `periodState`, `periodStatus`, `publishedAt`, `archived`, `autoPublished`, `autoArchived`, `submittedCount`, `totalCount`, server-precomputed `canReopen`, server-precomputed `canArchive`. The new `PeriodListBucket` and `PeriodListItem` types join the shared surface.

+12 contract tests (bucket enum coverage, row happy-path, edge cases like `periodState='reopened'` rejection).

**API service + repository + tRPC (commit `e40062c`).**

`AdminService` gains three new methods:

```
listPeriodsByState({ bucket, limit? }): Promise<PeriodListItem[]>
archivePeriod(periodId): Promise<{ success: true }>
unarchivePeriod(periodId): Promise<{ success: true; periodState: PeriodState }>
```

`listPeriodsByState`:

- Bucket resolver fans `'active' → [scheduled, open, published]` and `'archive' → [archived]`. Concrete state values pass through.
- Hot path uses the `(periodState, periodStart desc)` composite index from 51-C — no index gap.
- Submission progress (submittedCount / totalCount) comes from two grouped queries against `ReportSection` (one for total, one for submitted) so the endpoint stays at two round-trips regardless of page size.
- `canReopen` is derived from `AppSettings.allowReopenAfterPublish` + `reopenWindowHours` + `publishedAt`. `canArchive` is `periodState === 'published' && !archived`.
- Limit clamped to `[1, 200]`; default 50.

`archivePeriod`:

- Atomic write `{ archived: true, periodState: 'archived' }` so the 51-C two-state-machine invariant (Open Question 1 in 51-C-SUMMARY) holds even when the auto-archiver scheduler has not yet ticked.

`unarchivePeriod`:

- Reads the legacy `(status, periodStatus)` tuple to derive the next `periodState` (the new state column lost the pre-archive distinction). Projection: `status='published' OR periodStatus !== 'open' → 'published'`; else `'open'`. Scheduled-vs-open distinction is lost across an archive round-trip; acceptable trade-off documented in the deviations.

`PeriodService.reopenPeriod` gained a **reopen-policy gate** (Rule 2 — critical functionality from 51-A spec that 51-A explicitly deferred and 51-C did not pick up):

- New constructor arg `ReopenPolicyReader` (defaults to a null reader → no gate → pre-51-B tests unchanged).
- When wired, throws `PeriodAccessError` if `allowReopenAfterPublish=false` (master switch) or if `now > publishedAt + reopenWindowHours * 1h` (window expired).
- Production wiring (`period.module.ts`) resolves to `AdminService.getSettings()` per call. The admin settings query is upsert-on-singleton so this stays a single round-trip.

tRPC: `admin.listPeriodsByState` (query), `admin.archivePeriod` (mutation), `admin.unarchivePeriod` (mutation) — all `adminProcedure`-gated.

+15 unit tests:

- `admin.service.test`: 11 cases covering listPeriodsByState bucket fan-out, canReopen window arithmetic, canArchive published-only gate, archivePeriod / unarchivePeriod flow, limit clamping, missing-implementation guard.
- `period.service.test`: 4 cases covering reopen-policy master switch, window expiry, in-window happy path, legacy un-gated callers.

**Web — PeriodsTab redesign + nav wiring (commit `83b8ab4`).**

New `PeriodsTab` (rewrite — old file was dead code never reached by the router):

```
┌─ Active ────────────────────────────────────────────────────┐
│  scheduled · open · published                               │
│  always rendered, primary panel                             │
└─────────────────────────────────────────────────────────────┘
┌─ Archive [▶ collapsed] ────────────────────────────────────┐
│  archived                                                   │
│  query gated by `enabled: showArchive` — opt-in             │
└─────────────────────────────────────────────────────────────┘
```

Each row renders period range, state badge with per-state color, submission-progress badge (`4/6` with red <50% / amber 50-99% / green ≥100% tones; em-dash for `totalCount=0` un-provisioned periods), deadline date, and a 3-dot kebab menu. When `periodStatus='reopened'` (independent of `periodState` per 51-C two-state-machine design), a small `(reopened)` pill renders next to the state badge.

Action menu items vary by state:

| state                         | menu items                     |
| ----------------------------- | ------------------------------ |
| `open`                        | Publish now                    |
| `published` (canReopen=true)  | Reopen · Archive               |
| `published` (canReopen=false) | Archive                        |
| `archived`                    | Unarchive                      |
| `scheduled`                   | (none — auto-creator advances) |

Menu trigger is disabled (cursor: not-allowed + 30% opacity) when the row has no legal moves. Click-outside dismissal mirrors the pattern used by other admin dropdowns.

Mutations wired:

- `period.publish` / `period.reopen` (existing headProcedure surfaces; admin role aliased)
- `admin.archivePeriod` / `admin.unarchivePeriod` (new)

PeriodsTab owns its own queries (`admin.listPeriodsByState` × 2 — once for `active`, once gated for `archive`); does not pipe through admin-panel's snapshot.

**Nav wiring** (the original tab was never mounted — discovered mid-implementation as a Rule 3 finding):

- `/admin/page.tsx`: `'periods'` added between `'products'` and `'reminders'`. `TAB_LABELS.periods = 'Periods'`.
- `admin-tabs-mobile-select.tsx`: mirrored — `'periods'` added to `AdminTab` union + `TABS` array.
- `admin-panel.tsx`: dispatch added (`{activeTab === 'periods' && <PeriodsTab />}`); fallback `!["users","groups","products","reminders"].includes(...)` guard widened to include `"periods"`.

+11 RTL tests covering:

- Active row rendering with state badge + progress
- Archive section collapsed-by-default + opt-in expansion
- Action menu visibility per state (open / published-fresh / published-stale / archived)
- `canReopen=false` row hides Reopen menu item
- Mutation invocations carry the correct payload (`reportId` for period.\*, `periodId` for admin.\*)
- `(reopened)` badge appears when `periodStatus='reopened'`
- Progress badge shows em-dash when `totalCount=0`

## Deviations from Plan

**Scope reduction from PLAN.md per orchestrator override:**

1. **Three mutations, not six.** PLAN.md listed `admin.updatePeriodDeadline`, `admin.deletePeriod`, plus Edit deadline / Add note / Re-publish PDF / Permanent delete menu items. Prompt narrowed scope to three (`archivePeriod`, `unarchivePeriod`, `listPeriodsByState`) plus the two existing `period.*` mutations. Followed the prompt — the wider menu does not fit the 2–3h budget and four of the items overlap existing surfaces (PDF re-export lives on `pdfExport.request`; period deletion would need a new domain primitive with submission-count guards).

2. **Reused `period.publish` / `period.reopen` instead of admin aliases.** The prompt initially listed `admin.publishPeriod` / `admin.reopenPeriod` wrappers; on inspection, those procedures don't exist — the codebase has `period.publish` / `period.reopen` as `headProcedure` and admin role is aliased to head at the procedure level. Wiring directly to the existing surfaces is a smaller diff with no behavior change.

3. **Added a fresh richer-payload endpoint instead of extending `reportPeriodSchema`.** Per advisor recommendation: extending the snapshot schema would force every admin-snapshot consumer to handle the new optional fields. A dedicated `admin.listPeriodsByState` keeps the new shape (`submittedCount / totalCount / canReopen / canArchive`) scoped to the new tab.

### Auto-fixed Issues

**1. [Rule 2 — Missing critical functionality] PeriodService.reopenPeriod did not enforce the 51-A reopen-policy knobs.**

- **Found during:** API design review.
- **Issue:** 51-A SUMMARY explicitly deferred the reopen-window enforcement to 51-C. 51-C SUMMARY did not pick it up (read-side / state-machine focus only). Result: `AppSettings.allowReopenAfterPublish` and `reopenWindowHours` were dead config that the UI would have to enforce client-side — a security and UX defect.
- **Fix:** Added `ReopenPolicyReader` constructor arg with a null-default (so pre-51-B tests keep passing). Throws `PeriodAccessError` when `allowReopenAfterPublish=false` or when `now > publishedAt + reopenWindowHours * 1h`. Wired in `period.module.ts` to resolve from `AdminService.getSettings()`. Surfaces through `mapDomainError` as `BAD_REQUEST` so the admin tab's `onError` handler displays the precise reason ("Reopen window expired (72h after publication).").
- **Files modified:** `apps/api/src/modules/period/period.service.ts`, `apps/api/src/modules/period/period.service.test.ts`, `apps/api/src/modules/period/period.module.ts`.
- **Commit:** `e40062c` (bundled with the rest of the API work).

**2. [Rule 3 — Blocking issue] PeriodsTab was dead code — never mounted.**

- **Found during:** Web wiring inspection (`grep -r PeriodsTab apps/web/src` returned only the file itself).
- **Issue:** `apps/web/src/components/admin/periods-tab.tsx` existed but `/admin/page.tsx` did not include `'periods'` in its `tabs` array. The `admin-panel.tsx` `activeTab` switch had no branch for it. Result: even on `?tab=periods`, the router treated it as an unknown tab and fell back to `UsersTab` silently. The whole point of 51-B (redesign the Periods tab) presupposes the tab is reachable.
- **Fix:** Three coordinated edits — added `'periods'` to the `tabs` const array in `/admin/page.tsx`, the `AdminTab` union + `TABS` array in `admin-tabs-mobile-select.tsx`, and a `{activeTab === 'periods' && <PeriodsTab />}` branch in `admin-panel.tsx` (plus widening the fallback `!includes(...)` guard).
- **Files modified:** `apps/web/src/app/(app)/admin/page.tsx`, `apps/web/src/components/admin/admin-tabs-mobile-select.tsx`, `apps/web/src/components/admin/admin-panel.tsx`.
- **Commit:** `83b8ab4` (bundled with the rest of the web work).

## Authentication gates

None — pure schema + API + UI work. No SAML / Keycloak surface touched.

## Verification

```
pnpm --filter @customreport/shared test --run         → 494 passing (was 482, +12)
pnpm --filter @customreport/api test --run            → 823 passing (was 808, +15)
pnpm --filter @customreport/api test:integration --run → 66 passing (unchanged)
pnpm --filter @customreport/web test --run            → 333 passing (was 322, +11)

pnpm --filter @customreport/shared exec tsc --noEmit  → exit 0
pnpm --filter @customreport/api exec tsc --noEmit     → exit 0
pnpm --filter @customreport/web exec tsc --noEmit     → exit 0
```

Manual path tracing (no browser; mental walkthrough):

| Path                                                  | Expected                                                        |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| `/admin?tab=periods` initial load                     | Active section renders, archive collapsed, single query queued. |
| Active section with scheduled+open+published rows     | Three rows, each with correct state badge color.                |
| Open row → kebab → menu                               | `Publish now` only (no Archive — canArchive=false).             |
| Published-fresh row (canReopen=true) → kebab → menu   | `Reopen` + `Archive`.                                           |
| Published-stale row (canReopen=false) → kebab → menu  | `Archive` only.                                                 |
| Archive toggle click                                  | Section expands, `archive` query fires, archived rows render.   |
| Archived row → kebab → menu                           | `Unarchive` only.                                               |
| Reopen click (server gate fails)                      | Toast surfaces the precise PeriodAccessError message.           |
| UFB-049 vocabulary check (`groups-tab.tsx` untouched) | Confirmed: no diff to that file across the three commits.       |

## Open questions

**1. SCHEDULED → Open manual transition.** The auto-creator scheduler flips `scheduled → open` on its daily tick when `periodStart <= now`. 51-B does not expose a "Force open" menu item. If a head needs to advance a scheduled row faster than the next tick, they currently have no UI escape hatch. Trade-off: adding `admin.forceOpenPeriod` is a 30min task but expands the API surface for a thin use case. Recommendation: defer until a real ops request surfaces.

**2. Active bucket includes published-out-of-window.** Currently the active bucket fans out to `{ scheduled, open, published }` regardless of reopen window; the UI uses `canReopen` to hint actionability. If 51-D wants strict server-side bucketing (`published-out-of-window` → archive section), the bucket resolver in `AdminService.resolveBucketStates` is the seam. Trade-off: stricter buckets simplify the UI but require server-side date math on every list call.

**3. Submission progress tooltip with per-lead breakdown.** PLAN.md mentioned "hover shows tooltip listing lead names + status". The 51-B implementation surfaces the aggregate `submittedCount/totalCount` only. Adding the per-lead breakdown requires either extending `PeriodListItem` with a `leadStatuses: LeadStatus[]` array (medium cost — every list call carries N rows of redundant data) or a separate `admin.getPeriodSubmissionDetail` query (small cost, but needs hover→fetch latency handling). Recommendation: pick the second when 51-D surfaces a UAT pain point.

**4. `Report.archived` and `periodState='archived'` are redundant** (per 51-C SUMMARY Open Question 1). 51-B writes both atomically. If a future plan collapses them, the `archivePeriod` / `unarchivePeriod` methods are the single seam.

## What follow-on phases will consume

- **Wave B closure.** With 51-B landed, the trio 51-A (schema + Settings UI prefill) + 51-C (state-machine writers + adapter + audit) + 51-B (read-side + admin UI + reopen-policy gate) is complete. The 51-A `AppSettings` knobs are no longer dead config — `allowReopenAfterPublish` + `reopenWindowHours` enforce server-side, and the auto-publisher / auto-archiver write `periodState` atomically with the legacy tuple.

- **52 (next).** Dashboard / archive list read paths can now switch from filtering on `(status, archived)` to filtering on `periodState` directly (the composite index from 51-C is in place). The legacy-tuple fallback can stay for one more release window per 51-C's rollout plan.

## Commits

| #   | Hash      | Scope                                                                    |
| --- | --------- | ------------------------------------------------------------------------ |
| 1   | `c882e49` | shared: `periodListBucketSchema` + `periodListItemSchema` + 12 tests     |
| 2   | `e40062c` | api: `admin.listPeriodsByState` + archive/unarchive + reopen-policy gate |
| 3   | `83b8ab4` | web: `PeriodsTab` rewrite + nav wiring + 11 RTL tests                    |

## Self-Check: PASSED

- [x] `packages/shared/src/schemas/report.ts` carries `periodListBucketSchema` + `periodListItemSchema`.
- [x] Commit `c882e49` (shared) in `git log`.
- [x] Commit `e40062c` (api) in `git log`.
- [x] Commit `83b8ab4` (web) in `git log`.
- [x] `apps/web/src/components/admin/periods-tab.test.tsx` exists.
- [x] Shared 494, API unit 823, API integration 66, web 333 — all passing.
- [x] tsc clean on api, web, shared.
- [x] `groups-tab.tsx` not in modified files list (UFB-049 vocabulary preserved).
