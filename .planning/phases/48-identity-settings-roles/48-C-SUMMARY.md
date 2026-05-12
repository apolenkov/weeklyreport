---
phase: 48
plan: 48-C
subsystem: role-consistency, dashboard, reminder-policy
tags: [UFB-038, UFB-040, role-guard, scope-leak, reminder-policy, 48-C]
requires: [44-02, 46-02]
provides: [IfRole utility, policy-driven canSendReminder]
affects:
  - apps/web/src/components/auth/if-role.tsx (NEW)
  - apps/web/src/components/dashboard/alert-bar.tsx
  - apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts
decisions:
  - Defensive mapper filtering skipped — backend `review.dashboard` already applies `groupScopeFilter(session, 'reportSection')` (Phase 46-02). Mapper test pinned to confirm pendingLeads ⊆ scoped review input.
  - `hasActiveReminderRule` wire-name preserved; semantics migrated to ReminderPolicy validity-window check. Avoids a cross-cutting rename in shared schema + 6+ test fixtures.
metrics:
  duration: ~30min
  completed: 2026-05-10
---

# Phase 48 Plan C: Role Consistency Sweep — Summary

Closed three role/scope leaks reported by a head-role user on 2026-05-10:
admin-only "Configure reminders" link visible to head, alert-bar pendingLeads
suspected of scope leak, and Send Reminder semantics still tied to the legacy
ReminderRule presence instead of the Phase 44 ReminderPolicy validity window.

## Files Changed

| File                                                                    | Kind | Purpose                                                                          |
| ----------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------- |
| `apps/web/src/components/auth/if-role.tsx`                              | NEW  | Centralised `<IfRole role="...">` role-guard wrapper (auth.me-driven).           |
| `apps/web/src/components/auth/if-role.test.tsx`                         | NEW  | 6 unit tests: loading/null/match/mismatch/array-match/array-mismatch.            |
| `apps/web/src/components/dashboard/alert-bar.tsx`                       | MOD  | "Configure reminders" link wrapped in `<IfRole role="admin">`; tooltip migrated. |
| `apps/web/src/components/dashboard/alert-bar.test.tsx`                  | NEW  | 6 unit tests for the role-gated link + policy-aware tooltip.                     |
| `apps/web/src/lib/mappers/dashboard.test.ts`                            | MOD  | +2 UFB-040 regressions: pendingLeads ⊆ review, empty review ⇒ empty pendings.    |
| `apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts` | MOD  | `hasActiveReminderRule` derived from active ReminderPolicy validity window.      |

## Admin-Link Audit (`grep -rn 'href="/admin' apps/web/src/components`)

### Before

```
apps/web/src/components/admin/products-tab.tsx:198      href="/admin?tab=products"
apps/web/src/components/dashboard/alert-bar.tsx:109     href="/admin?tab=reminders"   ← UNGUARDED (head sees it)
```

### After

```
apps/web/src/components/auth/if-role.tsx:26             href="/admin?tab=reminders"   ← docstring example only
apps/web/src/components/admin/products-tab.tsx:198      href="/admin?tab=products"    ← inside (admin) route group (admin layout guard)
apps/web/src/components/dashboard/alert-bar.tsx:111     href="/admin?tab=reminders"   ← inside <IfRole role="admin">
```

Zero unguarded `/admin` links remain in `apps/web/src/components/**/*.tsx`. The
`(admin)` route group at `apps/web/src/app/(app)/admin/layout.tsx` enforces an
SSR admin-only gate (`REQUIRED = ['admin']`, ForbiddenPage on mismatch), so the
products-tab link is structurally protected. The alert-bar link is wrapped in
the new `<IfRole>` utility. The if-role.tsx match is the JSDoc usage example.

## `canSendReminder` — Semantics Migration

### Before

```ts
// weekly-report.prisma-repository.ts
include: {
  reminderRules: { where: { status: 'active' }, select: { id: true }, take: 1 },
}
...
hasActiveReminderRule: report.reminderRules.length > 0,
```

True iff at least one **ReminderRule** row with `status='active'` existed for
this report. Failed under the Phase 44 policy-driven scheduler: rules are
materialised lazily by `PolicyApplicatorService` against the upcoming period,
so a period that has an active policy but no fired-yet rule reported
`hasActiveReminderRule=false` → head saw a disabled Send Reminder button and
(if admin) an unhelpful "Configure reminders" link.

### After

```ts
const activePolicyCount = await this.prisma.reminderPolicy.count({
  where: {
    active: true,
    validFrom: { lte: report.deadline },
    OR: [{ validUntil: null }, { validUntil: { gte: report.deadline } }],
  },
});
...
hasActiveReminderRule: activePolicyCount > 0,
```

True iff `∃` an active `ReminderPolicy` whose validity window includes the
current report's `deadline`: `validFrom ≤ deadline ≤ (validUntil ?? +∞)`.
Wire-format field name (`hasActiveReminderRule`) preserved to keep the shared
schema + 6 contract/integration fixtures stable; the semantic shift is purely
inside the repository's derivation.

## `pendingLeads` Source Trace

```
Dashboard UI (alert-bar.tsx)
  ←  AlertBarProps.pendingLeads: string[]
  ←  dashboard-page.tsx:235  const { pendingLeads } = mapDashboardData({ review, archive, weeklyReport })
  ←  mappers/dashboard.ts:295  pendingLeads = leads.filter(l => l.status === 'pending').map(l => l.name)
  ←  leads built from `review` input
  ←  trpc.review.dashboard  (headProcedure)
  ←  reviewService.getSubmissionDashboard(activeReportId, ctx.session)
  ←  ReviewPrismaRepository.getSubmissionDashboard
  ←  prisma.reportSection.findMany({
        where: { reportId, ...groupScopeFilter(session, 'reportSection') },
      })
```

The session-scoped filter at the repository layer (`apps/api/src/modules/review/review.prisma-repository.ts:21-24`) was added in Phase 46-02 and is exercised by `apps/api/src/modules/review/review.service.test.ts:134-148` (UFB-040 / 46-02 spy assertion). The mapper test now pins the downstream contract: `pendingLeads ⊆ review` and `review === [] ⇒ pendingLeads === []` (apps/web/src/lib/mappers/dashboard.test.ts new UFB-040 cases).

Conclusion: the dashboard path for `pendingLeads` is correctly scoped end-to-end. The original head-user observation was likely the disabled-button/Configure-reminders combination from the `hasActiveReminderRule` legacy-rule mis-signal, which is fixed by the policy-driven migration above.

## Test Counts

| Suite               | Before    | After    | Δ   |
| ------------------- | --------- | -------- | --- |
| `@customreport/web` | 36 / 292  | 38 / 306 | +14 |
| `@customreport/api` | n/n / 710 | 62 / 714 | +4  |

(api delta of +4 is from the concurrent 47-03 agent's metrics tests, not from this plan — 48-C did not add api tests beyond the repository-level migration which was structurally identical to the existing `getActiveReportId`-only test surface. The repository-level `getWeeklyReport` has no unit test today; the assertion runs through `weekly-report.contract.test.ts` and `weekly-report.integration.test.ts` against the wire schema with `hasActiveReminderRule: true` fixture, both still green.)

### New tests

```
apps/web/src/components/auth/if-role.test.tsx
  IfRole — Phase 48-C role-guard wrapper
    ✓ renders nothing while auth.me is still loading
    ✓ renders nothing when the session resolves to null
    ✓ renders children when the single-role gate matches
    ✓ renders nothing when the single-role gate does not match
    ✓ renders children when the array-role gate includes the current role
    ✓ renders nothing when the array-role gate excludes the current role

apps/web/src/components/dashboard/alert-bar.test.tsx
  AlertBar — Phase 48-C role gating
    ✓ renders the Configure reminders link for admin when canSendReminder=false
    ✓ hides the Configure reminders link for head even when canSendReminder=false
    ✓ hides the Configure reminders link for lead
    ✓ hides the Configure reminders link when canSendReminder=true (admin)
    ✓ uses the policy-aware tooltip on the disabled Send Reminder button
    ✓ renders nothing when there are no pending leads

apps/web/src/lib/mappers/dashboard.test.ts
  + UFB-040: pendingLeads is a strict subset of the scoped review input
  + UFB-040: empty review (scoped-out caller) yields empty pendingLeads
```

## Manual UAT — Dev-Login Smoke

```bash
$ curl -s -o /dev/null -w "HTTP %{http_code}\n" \
    "http://localhost:3002/auth/dev-login?role=head&email=head@customreport.local&redirect=/"
HTTP 302
```

Head dev-login still issues a 302 redirect to `/` after the container restart.
Full visual UAT (head dashboard ⇒ no "Configure reminders"; admin dashboard ⇒
link visible only when no active policy) is captured by the new unit tests; a
human pass against the running compose stack is recommended but not blocking.

## Deviations

- **Defensive mapper-level `allowedGroupIds` filter — skipped.** Plan step 3 made this contingent on the backend bypassing scope; the backend already applies `groupScopeFilter(session, 'reportSection')` in Phase 46-02 (verified in `review.prisma-repository.ts:21-24`). Adding a redundant client filter would have required extending `SubmissionDashboardRow` with `reportingGroupId` (a shared-schema change) for no security benefit. The mapper instead got two pinning tests asserting `pendingLeads ⊆ review` to prevent a future regression where the mapper invents leads from a different source.
- **`hasActiveReminderRule` field NOT renamed.** Plan step 4 suggested adding a new `reminders.hasActivePolicyForPeriod` tRPC procedure. The cheaper migration was to swap the derivation inside the existing `weeklyReport.get` repository call without changing the wire shape — keeps all 6 contract/integration fixtures and the dashboard-page consumer unchanged. The next plan in this phase can rename if the wire name proves misleading.
- **`trpc.middleware.ts` not touched.** Concurrent agent 47-03 had modifications staged there; this plan avoided it per the prompt directive. (Status check at commit time showed those files were either reverted or committed by 47-03 in between — either way 48-C did not edit any 47-03 path.)
- **No `dispatchPending` migration.** The reminders.dispatchPending mutation still resolves a `reminderRule` row to drive the actual send; this is the correct boundary — `canSendReminder` is a UI signal, while the dispatch pipeline still needs a concrete rule with a fireAt to dedupe against executions. A follow-up plan (48-A or 48-B per phase plan) will migrate the dispatch path if desired.

## Self-Check

- [x] `apps/web/src/components/auth/if-role.tsx` exists
- [x] `apps/web/src/components/auth/if-role.test.tsx` exists
- [x] `apps/web/src/components/dashboard/alert-bar.test.tsx` exists
- [x] `apps/web/src/components/dashboard/alert-bar.tsx` modified (IfRole import, wrapped link, new tooltip)
- [x] `apps/web/src/lib/mappers/dashboard.test.ts` modified (+2 cases)
- [x] `apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts` modified (policy-window count)
- [x] `pnpm --filter @customreport/web lint` clean
- [x] `pnpm --filter @customreport/api lint` clean
- [x] `pnpm --filter @customreport/web test` 306 passed
- [x] `pnpm --filter @customreport/api test` 714 passed
- [x] `grep 'href="/admin'` audit shows no unguarded match in `apps/web/src/components/**/*.tsx`
- [x] Docker `compose restart api web` succeeded; head dev-login returns 302

## Self-Check: PASSED
