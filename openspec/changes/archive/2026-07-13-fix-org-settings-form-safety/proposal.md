## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

The Settings → Identity form (and the shared settings-mutation helper it
shares with the Notifications sub-tab) has two correctness gaps confirmed by
adversarial verification. First, `IdentitySubTab`'s reseed effect
(`apps/web/src/features/organization/ui/settings-identity-sub-tab.tsx:25-30`)
rewrites `shortName`/`fullName` from `orgQ.data` on every query update with no
guard for unsaved edits; combined with the app's global `refetchOnWindowFocus`

- 30s `staleTime` defaults (`apps/web/src/lib/query-client.ts:42-43`), an
  admin who tabs away mid-edit and back can have in-progress input silently
  overwritten if the query refetches. `NotificationsSubTab`'s draft reseed
  (`apps/web/src/features/organization/ui/settings-notifications-sub-tab.tsx:17`)
  has the identical guardless pattern. Second, the shared post-save mutation
  (`apps/web/src/shared/ui/settings-tab-shared.tsx:20-25`, duplicated inline in
  `settings-identity-sub-tab.tsx:35-38`) calls
  `fetch("/api/revalidate-org", { method: "POST" })` with no `.ok` check and no
  `try/catch`, then fires `toast.success` unconditionally — a non-2xx response
  from the route (`apps/web/src/app/api/revalidate-org/route.ts:14,21`, which
  returns real 401/403s) still reports "saved", and per the adversarial
  correction, a thrown fetch instead surfaces as a false-failure error toast on
  a save that already succeeded (the Prisma write via `invalidateAdmin` already
  landed), not as an unhandled promise rejection.

Severity was lowered from the original P1 finding to P2: this is an
admin-only surface, the affected fields are two short re-typeable text
strings, the clobber requires a real concurrent-edit or type-during-refetch
window, and the toast defect misleads without destroying data.

## What Changes

- `apps/web/src/features/organization/ui/settings-identity-sub-tab.tsx`:
  track form dirtiness (compare live `shortName`/`fullName` against the
  last-seeded values, or an explicit `isDirty` flag) and only reseed the form
  from `orgQ.data` when the form is not dirty. Replace the inline
  `fetch("/api/revalidate-org", ...)` call with the shared, safety-fixed
  helper from `settings-tab-shared.tsx` (or apply the same `.ok`/try-catch
  fix locally) so a failed revalidation does not report "Organization
  identity saved".
- `apps/web/src/shared/ui/settings-tab-shared.tsx`: in
  `useUpdateSettingsMut`, check `response.ok` after the
  `/api/revalidate-org` fetch and wrap the call in `try/catch`. On a failed
  or non-ok revalidation, keep the existing `"${label} saved"` success toast
  (the underlying settings mutation did succeed) and additionally surface a
  distinct revalidation-failed toast/log so the admin knows the landing page
  cache may be stale, instead of silently swallowing the failure or turning
  a successful save into a false error toast.
- `apps/web/src/features/organization/ui/settings-notifications-sub-tab.tsx`:
  apply the same not-dirty reseed guard to `setDraft(serverSettings)` so an
  in-progress edit on the Notifications sub-tab survives a query refetch.
- Out of scope: the general comment-cleanup pass on
  `settings-identity-sub-tab.tsx` (tracked separately; this change only
  touches the lines needed for the dirty-guard and revalidate-safety fixes).

## Impact

- `apps/web/src/features/organization/ui/settings-identity-sub-tab.tsx`
- `apps/web/src/features/organization/ui/settings-notifications-sub-tab.tsx`
- `apps/web/src/shared/ui/settings-tab-shared.tsx`

Non-goals: no change to `/api/revalidate-org`'s own auth/CSRF behavior; no
change to the Prisma-layer `admin.updateOrganization` / `admin.updateSettings`
mutations; no broader dirty-tracking abstraction beyond the three affected
components.
