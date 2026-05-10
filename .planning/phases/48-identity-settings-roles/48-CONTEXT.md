# Phase 48: Identity, Settings & Role Consistency — Context

**Gathered:** 2026-05-10 (in-chat surface during Phase 44 UAT — three carry-over UI bugs + new org-concept idea)
**Status:** Ready for planning
**Mode:** Three vertical streams — C urgent (fixes), A+B fresh design (new product concepts)
**Driver:** role-leak bugs observed by head user + new org/department framing

<domain>
## Phase Boundary

Three independent streams, scheduled C → A → B (each is a separate plan):

**48-C — Role Consistency Sweep** (URGENT, fix carry-over bugs):

- `alert-bar.tsx` "Configure reminders" link is rendered unconditionally;
  must be role-gated to `admin` only (UFB-038 head ≠ admin).
- Dashboard `pendingLeads` (the «X haven't submitted» list) is NOT filtered
  by group scope — head sees leads from groups they don't run. Phase 46-02
  scoped `getSubmissionDashboard` but the alert-bar pendingLeads is
  computed from a separate path that bypassed the fix.
- `canSendReminder` semantics audit — verify the button's disabled state
  reflects the new ReminderPolicy model (Phase 44), not the legacy
  per-period rule presence.
- Cross-cut audit: grep every `<a href="/admin">`, `<Link href="/admin">`,
  and `window.location = '/admin'` site-wide; gate each behind a
  `role === 'admin'` guard or remove the affordance entirely for
  non-admin roles.
- Acceptance: head user logs in, navigates `/`, opens dashboard, sees
  ONLY their group's leads in alert-bar, sees NO admin-tab links, sees
  Send Reminder button enabled when a ReminderPolicy is active for the
  current Period.

**48-A — Org Identity Concept** (NEW model):

- New singleton DB row: `Organization { id='singleton', shortName,
fullName, createdAt, updatedAt }`. Default seed: `shortName='Demo'`,
  `fullName='Example Software Department'` (placeholder; admin
  overrides via Settings).
- Landing page (`/`): hero displays `shortName` (very large, brand
  treatment) above `fullName` (subtitle). Replaces the current "CustomReport"
  text affordance.
- Header / nav-bar uses `shortName` consistently (was hardcoded
  «CustomReport»).
- Migration of `AppSettings.departmentName` → `Organization.fullName`
  (one-shot copy in migration; departmentName column dropped after one
  release). Wire-format shim during the transition keeps
  `weekly-report-page.tsx`/`dashboard-page.tsx` working.
- Vocabulary fix: "department" in UI is the same thing as
  `ReportingGroup` in code. Either rename code or rename UI; recommend
  renaming UI to "Reporting Group" (less product churn).

**48-B — Settings Expansion** (NEW config knobs for flexibility):

Audit existing `AppSettings` fields and add the missing knobs that an
admin should reasonably want to tweak:

| now                 | added                                                            |
| ------------------- | ---------------------------------------------------------------- |
| departmentName      | (→ removed, replaced by Organization.shortName/fullName)         |
| autoCreatePeriods   | (keep; rename UI label «Автосоздание периодов»)                  |
| defaultDeadlineDays | (keep; rename UI label «Срок сдачи (дней до конца недели)»)      |
| —                   | `periodLengthDays` (7 or 14)                                     |
| —                   | `workingDays` enum (`mon-fri` / `mon-sun`)                       |
| —                   | `gracePeriodHours` (how long after deadline submissions allowed) |
| —                   | `defaultTimezone` (IANA, default for new ReminderPolicy)         |
| —                   | `notificationFromEmail`                                          |
| —                   | `autoPublishAfterDeadline` (boolean)                             |
| —                   | `autoArchiveWeeksAfterPublish` (int, 0 = never)                  |

**Out of scope:**

- Per-group settings (per-department override of global settings). Defer
  to future v9.0 multi-tenancy phase.
- Multi-org support (more than one Organization singleton).
- I18n / RU/EN switch — separate phase, larger surface.
- Theme / color customization — design system phase.

</domain>

<decisions>
## Implementation Decisions

- **C first, A+B later.** C is bug-fix urgency, the user has seen the
  bugs and is blocked. A and B are product-design + admin UI work that
  benefits from a sketch round and possibly a frontend-design pass.
  Don't bundle.

- **Organization as singleton, not as a row with multiple instances.**
  This codebase is single-tenant by design (Phase 46 group scope is
  multi-group within a single org, not multi-org). The Organization
  table is `id='singleton'` mirror of `AppSettings.id='singleton'`.
  When/if multi-org becomes a real requirement, migrate then; over-
  engineering today is YAGNI.

- **`departmentName` lives one release with both old + new fields**
  before drop. The migration: (1) create Organization, copy
  `departmentName` → `fullName`, generate a 3-letter shortName from
  initials. (2) Next release: drop `AppSettings.departmentName`.

- **Role guards in UI use a `<IfRole role="admin">` wrapper component,**
  not scattered `if (role === 'admin')`. Centralizing avoids the
  alert-bar.tsx class of leak.

- **`canSendReminder` derives from active ReminderPolicy presence,**
  not from any specific Rule existing. Reason: post Phase 44, Rules
  are derived from Policies on Period.create. If a Policy is active
  but no Period has fired the hook yet (e.g. immediately after seed
  reset), the button should still be ENABLED — the action will
  resolve via the dispatch path (which has its own no-active-rule
  fallback toast).

- **48-C ships before 48-A + 48-B,** as a separate phase commit batch.
  Keeps the role-fix surgical and reviewable in isolation.

</decisions>

<code_context>

## Existing Code Insights

- `apps/web/src/components/dashboard/alert-bar.tsx:108-114` — unconditional
  "Configure reminders" link. Add role-guard.
- `apps/web/src/components/dashboard/dashboard-page.tsx:236` — calls
  `pendingLeads` derivation; trace the source query (likely tRPC
  `review.getSubmissionDashboard` or a sibling).
- `apps/api/src/modules/review/review.service.ts:53` —
  `getSubmissionDashboard(reportId, session)` — Phase 46-02 wired session.
  Verify the alert-bar source actually receives the filtered rows.
- `apps/web/src/lib/role-home.ts` — canonical per-role home util
  (`roleHomePath`). Consider extending with `roleAllowsAdminLinks(role)`.
- `apps/web/src/components/admin/settings-tab.tsx` — current Settings UI;
  expand with the new fields in 48-B.
- `packages/shared/src/schemas/report.ts:275` — `appSettingsSchema` —
  extend with new fields in 48-B.
- `apps/web/src/app/page.tsx` — landing page; add org-identity hero in
  48-A.
- `prisma/schema.prisma` — add `Organization` model in 48-A; extend
  `AppSettings` with new fields in 48-B.

</code_context>

<specifics>
## Specific Ideas

- **48-C role guards (smallest possible diff):**

  ```tsx
  // alert-bar.tsx — wrap admin link:
  {role === 'admin' && !canSendReminder && (
    <a href="/admin?tab=reminders" ...>Configure reminders</a>
  )}
  ```

  `role` comes from the session context (already available via
  `useTRPC()` + `auth.me` query — see how `nav-bar.tsx` does it).

- **48-C dashboard group-scope (trace from UI down):**

  ```
  dashboard-page.tsx
    ↓ uses
  weeklyQ.data.alertBar.pendingLeads
    ↓ from
  weekly-report.prisma-repository.ts (Phase 46-04 patched here)
    ↓ ?
  Verify the leads list is built using groupScopeFilter(session, 'user').
  ```

- **48-A landing hero:**

  ```tsx
  <h1 className="text-6xl font-bold tracking-tight">
    {org.shortName}
  </h1>
  <p className="text-xl text-muted-foreground mt-2">
    {org.fullName}
  </p>
  ```

- **48-B Settings new fields — Zod additions:**

  ```ts
  periodLengthDays: z.number().int().min(1).max(31).default(7),
  workingDays: z.enum(['mon-fri', 'mon-sun']).default('mon-fri'),
  gracePeriodHours: z.number().int().min(0).max(168).default(0),
  defaultTimezone: z.string().min(1).default('Europe/Moscow'),
  notificationFromEmail: z.string().email().nullable().default(null),
  autoPublishAfterDeadline: z.boolean().default(false),
  autoArchiveWeeksAfterPublish: z.number().int().min(0).default(0),
  ```

</specifics>

<deferred>
## Deferred Ideas

- Per-ReportingGroup setting overrides (e.g. one group has a different
  deadline than the org default). Multi-tenancy concern.
- Visual brand customization (logo upload, primary color picker) —
  design system work.
- Inline help / tooltips for each setting (UX polish phase).
- A history / audit log for setting changes — Phase 46-05 already emits
  generic mutation events; this would add a specialized "settings
  changed" event with diff payload.

</deferred>

## Verification Targets

After 48-C lands:

```bash
# Login as head
curl -L "http://localhost:3002/auth/dev-login?role=head&email=head@customreport.local&redirect=/"
# Open dashboard
# Assert: NO "Configure reminders" link
# Assert: only leads from head's group in pendingLeads
# Click "Send Reminder" — assert toast result, not "no-active-rule"
```

After 48-A + 48-B land:

```bash
# Landing page
curl http://localhost:3000/ | grep -i "Demo\|Example Software Department"
# Settings tab in /admin
# Assert all new fields render and persist
```

## Acceptance Gate

Phase 48 closes when:

1. ✓ Head session does not see any admin-only affordances on dashboard
2. ✓ Head dashboard pendingLeads filtered by head's reportingGroupId
3. ✓ Send Reminder semantics match Phase 44 model (policy-driven)
4. ✓ Landing page hero shows Organization.shortName + fullName
5. ✓ Settings tab exposes the 7 new config fields
6. ✓ AppSettings.departmentName migrated to Organization.fullName
