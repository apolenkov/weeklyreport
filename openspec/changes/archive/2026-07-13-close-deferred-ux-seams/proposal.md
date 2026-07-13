# Change: Close the deferred UX/robustness seams from the repo-excellence run

## Why

The 2026-07-13 implementation run deliberately deferred three small seams as
Non-Goals of their parent changes (recorded in
`docs/reviews/repo-excellence-implementation-2026-07-13.followups.md`). Each
is a real, user-visible defect with a known house pattern to apply:

1. **Settings drafts get clobbered.** The Periods and Reminders settings
   sub-tabs reseed their local draft from the server query on every data
   change (`useEffect(() => setDraft(serverSettings), [serverSettings])`),
   so a background refetch overwrites an admin's in-progress edit. The
   Identity/Notifications sub-tabs already carry the dirty-guard pattern.
2. **Dev role-switcher redirects on failed logout.** Its logout and
   switch-user actions redirect regardless of the `POST /auth/logout`
   outcome — the exact fire-and-forget the nav-bar logout button dropped
   (spec: "The client logout control only redirects after a confirmed
   logout").
3. **Case-variant UUID duplicates still 500 on activity create.** The
   `linkedProductIds` uniqueness refine compares raw strings, so
   `"ABC…"` + `"abc…"` passes validation, collides in Postgres's
   case-insensitive `uuid` column, and surfaces as an unhandled `P2002`.

## What Changes

- Extract the Identity sub-tab's dirty-guard (isDirty + last-seeded ref) into
  a shared hook and apply it to the Periods and Reminders sub-tabs.
- Gate every role-switcher redirect (logout, switch-user, post-reseed) on an
  OK logout response, mirroring the nav-bar behavior.
- Normalize `linkedProductIds` to lowercase in the shared schemas so the
  uniqueness refine catches case-variant duplicates, and lowercase in the
  repository's defense-in-depth dedupe; drop the vacuous `newActivityId`
  assertion in the activity integration test.

## Impact

- Affected specs: `admin-settings-ui`, `session-endpoint-hardening`,
  `activity-reporting-unit`
- Affected code: `apps/web/src/features/period/ui/settings-periods-sub-tab.tsx`,
  `apps/web/src/features/admin/ui/settings-reminders-sub-tab.tsx`,
  `apps/web/src/shared/ui/settings-tab-shared.tsx` (or a sibling hook module),
  `apps/web/src/shared/ui/role-switcher.tsx`,
  `packages/shared/src/schemas/project-activity.schema.ts`,
  `apps/api/src/modules/project-activity/project-activity.prisma-repository.ts`,
  plus their tests.
- No schema/DB migration; no API contract change (inputs already typed
  `string[]`; output ids were always lowercase from Postgres).
