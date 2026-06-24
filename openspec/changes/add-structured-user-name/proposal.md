# User-record overhaul: structured ФИО, position, display forms, SAML create-only

## Why

Live admin UAT (2026-06-24, `/admin?tab=users`) plus a parallel ФИО grilling
session. One bundle of related user-record changes came back; they all reshape
the same `User` record + admin form + identity flow, so they land as one change
(MVP "Database Is Disposable" — a single `migrate reset` + reseed, no
incremental migration). Implemented by Work 3.

Today `User.name` is a single `String`, the canonical display name read in 30+
web sites plus reports, sections, and lead identity. In production it is
provisioned from SAML, which supplies only a single `displayName`
(`saml-profile.ts:29`) — never name parts and (per the grilling) never a role.

Base decision (kept): `name` STAYS a stored, denormalized display field — a
computed/derived `name` would blank out every SAML-provisioned user.

## What Changes

### 1. Structured ФИО name parts

- Add `lastName` (required), `firstName` (required), `middleName` (nullable —
  отчество is optional) to `User`. `name` stays a stored column, recomputed from
  the parts in ФИО / surname-first order (`"{lastName} {firstName}
{middleName}"`, trimmed) on the admin write path.
- `adminUserSchema` + `AdminUser` carry the parts; the admin form edits three
  English-labelled inputs (`Last name` / `First name` / `Middle name`),
  last+first required.

### 2. Position (должность)

- Add `position String?` to `User` — free-text HR job title (e.g. «Тимлид»),
  nullable, **admin-maintained only**. Keycloak carries its own должность but it
  is NOT pulled.
- DISTINCT from `role` (the access level). `adminUserSchema` gains
  `position: z.string().nullable()`; the form gets a `Position` input; the Users
  table gets a `Position` column.

### 3. Display forms + initials bug fix

- **Short form** «Берёзов А.В.» = surname + given/patronymic initials; no
  patronymic → «Берёзов А.». Shown in the Users table.
- **Initials fix.** `initialsFromName` (`nav-bar.tsx:141`) takes first-word +
  **last**-word, so an ФИО string yields surname+patronymic («БВ»). It must be
  surname + given («БА»). The avatar reads the **session** user
  (`SessionUser`, which today carries only `name`), so the parts are plumbed
  through `auth.me` (`auth.routes.ts:265`) into `SessionUser`; the shared
  initials helper prefers parts and falls back to a name-string heuristic
  (first+second token under surname-first order) for records without parts
  (SAML stubs). `stage-assignment-editor.tsx:188` (`lead.name.split(" ")[0]`)
  switches to the structured surname.

### 4. SAML create-only / registration-only provisioning

- **Create-only.** First login of a missing user CREATES a stub
  (`role = viewer` always, `name = displayName`, parts + `position` `null`). An
  EXISTING user is NEVER re-synced — today `auth.routes.ts:213-231` overwrites
  `name`/`role`/`reportingGroupId` every login; change to create-only so the
  admin's ФИО, role, and position survive logins.
- **Role removed from the IdP.** Keycloak has no role attribute: drop `role`
  from `SamlProfileSchema` / `verifySamlProfile`; every SAML-provisioned user
  defaults to `viewer`. Roles are admin-assigned only. The threat-model comment
  in `saml-profile.ts` flips from "role REQUIRED, no over-grant" to "role
  absent, default viewer (least privilege)".
- **Account key = corporate email** (= `samlId`); no separate username, no
  corporate-domain allow-list.
- **Not affected:** dev-login (`AUTH_DEV_MODE`, `auth.routes.ts:404`) takes its
  role from a query param and does NOT use `SamlProfileSchema` — its role
  switching is untouched. The first admin comes from seeds
  (`seed-constants.ts:80`), so viewer-default does not lock anyone out of admin.

## Resolved decisions (user, 2026-06-24)

1. **Display order = ФИО, surname-first.** Seed displays reorder from "Alexey
   Petrov" to surname-first; intended.
2. **Existing records fully rebuilt, not migrated** — `migrate reset` + reseed,
   no alter-table backfill.
3. **One change, not two.** SAML provisioning ships in this same change; within
   the change the spec is split into topic capabilities for readability only.

## Impact

- Affected specs (deltas, all in this one change):
  - `structured-user-name` (NEW): name parts, stored display name, ФИО order,
    short form, initials helper.
  - `user-position` (NEW): admin-maintained position field.
  - `saml-provisioning` (NEW): create-only, viewer default, role removed from
    the assertion, email-as-key.
- Affected code (Work 3):
  - `prisma/schema.prisma` — `User` gains `lastName`, `firstName`, `middleName`,
    `position`. No FTS change (User has no `searchTsv`).
  - `packages/shared/src/schemas/report.schema.ts` — `adminUserSchema` gains the
    four fields; `AdminUser` follows.
  - `packages/shared/src/auth/saml-profile.ts` — `role` removed from
    `SamlProfileSchema`; threat-model comment updated.
  - `apps/api/src/modules/auth/saml.strategy.ts` (`verifySamlProfile`) — stop
    requiring/forwarding role.
  - `apps/api/src/modules/auth/auth.routes.ts` — SAML branch becomes create-only
    (no overwrite of existing); new users default `role=viewer`; `auth.me`
    (`:265`) returns the name parts for the session.
  - `apps/web/src/lib/session-provider.tsx` — `SessionUser` gains `lastName` /
    `firstName` (+ optional `middleName`).
  - shared initials/short-form helper (new, in `@customreport/shared`) consumed
    by the Users table, nav avatar, and stage chip.
  - `apps/web/src/lib/mappers/admin-form-inputs.ts`,
    `apps/web/src/components/admin/users-tab.tsx`,
    `apps/web/src/components/admin/mock-data.ts` — parts + position in the form,
    table columns (Position + short-form name).
  - `apps/web/src/components/navigation/nav-bar.tsx` (`initialsFromName`),
    `apps/web/src/components/admin/stage-assignment-editor.tsx:188` — initials /
    surname from structured parts.
  - `apps/api/src/modules/admin/admin-snapshot-write.queries.ts`,
    `apps/api/src/modules/admin/admin-snapshot.queries.ts` — write/read the parts
    - position.
  - `prisma/seed.ts`, `prisma/seed-simple.ts`, `prisma/seed-demo.ts`,
    `prisma/seed-constants.ts` — split names into parts (surname-first), populate
    position where natural.
  - `CONTEXT.md` — "Identity & users" glossary section (committed with this
    change).
  - Tests across the above.
- Not changed: the 30+ `name` read sites; Project/report FTS; print template;
  dev-login role flow.
