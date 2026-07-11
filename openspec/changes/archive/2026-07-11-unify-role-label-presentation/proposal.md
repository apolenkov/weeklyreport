## Why

The role vocabulary was unified behind two shared Zod types
(`unify-role-type`, `role-type` spec), but four presentation sites still
maintain their own copy of the role→label mapping instead of importing the
shared `ROLE_LABEL` map, so the same role renders different English labels
in different parts of the app — nav shows "Group Head" where every other
surface shows "Head". Two membership checks (`isRole`, `VALID_ROLES`) are
also hand-written literal lists instead of derived from the shared Zod
schema, and the repository's literal-union lint gate has no detector for
role tokens at all, so both can silently drift again.

## What Changes

- `nav-bar.tsx`'s `getRoleLabel` switch is replaced by a lookup into the
  shared `ROLE_LABEL` map (removes the "Group Head" / "Head" split).
- `users-tab.tsx`'s hand-written `ROLE_OPTIONS` label array is derived from
  `ROLE_LABEL` instead of duplicating role strings.
- `users-tab.tsx`'s `RoleBadge` renders the looked-up label instead of the
  raw role token with CSS `capitalize`.
- `dashboard.ts`'s `LeadInfo.role` is retyped from bare `string` to the
  shared `DbRole` type (persistence-axis read of the lead's stored role),
  and `lead-summary-table.tsx` renders its `ROLE_LABEL` lookup instead of
  the raw value.
- `login-page-roles.ts`'s `isRole` and `last-role.ts`'s `VALID_ROLES` are
  derived from `sessionRoleSchema.options` instead of hand-written literal
  lists.
- `scripts/find-status-literal-unions.mjs` gains a fourth detected
  vocabulary (the four role tokens), so a future hand-written role union
  is caught the same way a status union already is.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `role-type`: adds a requirement that role labels have one presentation
  source (`ROLE_LABEL`) and that role-membership checks derive from
  `sessionRoleSchema`/`roleSchema` rather than re-declaring the literal set.
- `status-type-ssot-gate`: the scanner's coverage is extended from three
  status vocabularies to four (adding the role-token vocabulary), and its
  name/description are read as covering literal-union regressions
  generally, not status alone.

## Impact

- `apps/web/src/shared/ui/navigation/nav-bar.tsx`
- `apps/web/src/features/admin/ui/users-tab.tsx`
- `apps/web/src/features/dashboard/model/dashboard.ts`
- `apps/web/src/features/dashboard/model/dashboard-leads.ts`
- `apps/web/src/features/dashboard/ui/lead-summary-table.tsx`
- `apps/web/src/app/login-page-roles.ts`
- `apps/web/src/lib/last-role.ts`
- `scripts/find-status-literal-unions.mjs` (+ its own test suite)

Non-goals: no change to session/DB role typing (`Role`/`DbRole` axes stay as
they are), no authorization/enforcement logic, no change to the dev-login
role set or dev-email values (separate follow-up).
