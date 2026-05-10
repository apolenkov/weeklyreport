# Phase 48-C — Role Consistency Sweep

**Status:** ready
**Depends on:** none (this is a bugfix wave; A + B come after)
**Requirement:** UFB-038 head≠admin separation + UFB-040 group scope completeness

## Goal

Close three carry-over role/scope leaks observed by a head-role user on
dashboard:

1. «Configure reminders» link in dashboard alert-bar visible to head
   (should be admin-only).
2. Dashboard alert-bar pendingLeads shows leads from groups the head
   does not run (group-scope leak — Phase 46 patched submissionDashboard
   but the alert-bar source bypassed it).
3. «Send Reminder» button semantics audit — verify `canSendReminder` is
   computed from active ReminderPolicy presence (Phase 44 model), not
   from legacy per-period rule existence.

Plus a defensive sweep: grep every `/admin` link/redirect in
`apps/web/src/` and gate each behind a role-guard, OR remove the
affordance for non-admin roles. Centralise the role check via a small
`<IfRole>` component (or `useRole()` hook) so the next leak is mechanical
to prevent.

After this plan: a head user can use the dashboard end-to-end without
ever seeing or being able to click into admin surfaces, and the alert-bar
data reflects only their group.

## Acceptance Criteria

- `apps/web/src/components/dashboard/alert-bar.tsx` — «Configure reminders»
  link rendered only when `role === 'admin'`.
- Dashboard data path for `pendingLeads` filters by `session.role + session.reportingGroupId` (head → own group only; admin → all; viewer → granted groups; lead → own section only).
- `canSendReminder` is true iff there is at least one ACTIVE
  `ReminderPolicy` whose validity window includes the current
  Period.deadline (post Phase 44 model). The legacy «has a
  ReminderRule with `reportId=current`» check is removed.
- New utility `apps/web/src/components/auth/if-role.tsx` exports
  `<IfRole role="admin">{children}</IfRole>` — uses session from
  `auth.me` query. Renders null when role doesn't match.
- Audit grep across `apps/web/src/components/**/*.tsx` for `/admin` URL
  references; every reference is either inside an admin-only layout
  (`apps/web/src/app/(admin)/`) OR wrapped in `<IfRole role="admin">`.
- Tests: 3 new web tests covering the alert-bar role gating + a unit
  test for `<IfRole>` + a test for `pendingLeads` filter.
- All existing tests stay green (web 292 → 296ish, api unchanged or +1).

## Steps

1. Add the `IfRole` utility:

   ```tsx
   // apps/web/src/components/auth/if-role.tsx
   "use client";
   import { useTRPC } from "../../lib/trpc-context";
   import { useQuery } from "@tanstack/react-query";
   import type { Role } from "@customreport/shared";

   export function IfRole({
     role,
     children,
   }: {
     readonly role: Role | readonly Role[];
     readonly children: React.ReactNode;
   }) {
     const trpc = useTRPC();
     const me = useQuery(trpc.auth.me.queryOptions());
     if (!me.data) return null;
     const allowed = Array.isArray(role)
       ? role.includes(me.data.role)
       : me.data.role === role;
     return allowed ? <>{children}</> : null;
   }
   ```

2. Patch `alert-bar.tsx`:
   - Import `IfRole`.
   - Wrap the «Configure reminders» `<a>` with `<IfRole role="admin">`.
   - While here: the title attribute on Send Reminder says «Configure a
     reminder rule in Admin → Reminders first» — change to «Active
     reminder policy required — ask your admin» for non-admin roles.

3. Trace pendingLeads source:
   - Grep `pendingLeads` in web src.
   - Follow to the tRPC query that produces it.
   - Verify the backend procedure uses `groupScopeFilter(session, 'user')`.
   - If the alert-bar `pendingLeads` is derived from a fork of
     `reviewService.getSubmissionDashboard` data, walk the data in
     `dashboard-page.tsx` to confirm filtering happens upstream OR add
     a `.filter(row => allowedGroupIds.includes(row.reportingGroupId))`
     in the mapper.

4. Verify `canSendReminder`:
   - Grep `canSendReminder` in web src.
   - Locate the computation. If it checks `reminderRules.some(r =>
r.reportId === activeReportId)`, replace with «∃ active
     ReminderPolicy whose `validFrom ≤ activePeriod.deadline ≤
(validUntil ?? +∞)`».
   - This may need a tRPC query addition; if so, add
     `reminders.hasActivePolicyForPeriod({ reportId })` returning
     `boolean`.

5. Audit `/admin` links:

   ```bash
   grep -rn 'href="/admin\|href=\`/admin' apps/web/src/components
   ```

   - Each match → wrap in `<IfRole role="admin">` OR move the affordance
     into the `(admin)` route group (which already has admin layout
     guard).

6. Tests:
   - `apps/web/src/components/auth/if-role.test.tsx` — renders null when
     role mismatches; renders children when matches; supports array role.
   - `apps/web/src/components/dashboard/alert-bar.test.tsx` — expand to
     cover (a) head sees no «Configure reminders», (b) admin sees it
     when `canSendReminder=false`, (c) head's pendingLeads is filtered.
   - If `canSendReminder` source changed: add backend test for the new
     procedure / refactor.

7. Manual UAT preparation:
   - After commit, restart containers: `docker compose restart api web`.
   - Log in as head: `/auth/dev-login?role=head&email=head@customreport.local&redirect=/`.
   - Confirm dashboard alert-bar has no «Configure reminders» link.
   - Confirm pendingLeads list contains only own-group leads.
   - Log in as admin: same flow; confirm «Configure reminders» visible
     when canSendReminder=false, hidden when active policy exists.

## Verification Commands

```bash
grep -rn 'href="/admin' apps/web/src/components | grep -v 'IfRole role="admin"'
# expected: zero matches (every admin link is gated)

rtk pnpm --filter @customreport/web lint
rtk pnpm --filter @customreport/web test
rtk pnpm --filter @customreport/api test
```

## Commit

Conventional Commit, one atomic commit covering ALL the changes above.

`fix(web): UFB-038/040 — role-gate admin links + group-scope dashboard alert-bar (48-C)`

Body mentions:

- IfRole utility introduced for role-guarded affordances
- alert-bar.tsx «Configure reminders» link now admin-only
- Dashboard pendingLeads filtered by session.reportingGroupId for head
- canSendReminder semantics migrated to Phase 44 policy-driven model
- Site-wide audit completed: zero unguarded /admin links
- Test count: web +N (list)
