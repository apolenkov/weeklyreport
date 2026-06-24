# Add structured user name parts (ФИО) to the User model and admin form

## Why

Live admin UAT (2026-06-24, `/admin?tab=users`, Edit-user dialog). The user
flagged that the single freeform **Name** field really represents a Russian
**ФИО** — фамилия / имя / отчество (surname / first name / patronymic) — and
asked to "do something about it". The decision (user, 2026-06-24): do a **full
data-model change**, not a form-only cosmetic split. This work is scoped to a
separate work stream ("Work 3"); this change is the spec it implements. No code
changes land in the current tree from this proposal.

Today `User.name` is a single `String`. It is the canonical display name read in
30+ web sites plus reports, sections, and lead identity on projects. In
production it is provisioned from SAML, which supplies only a single
`displayName` (`saml-profile.ts:29`) — never name parts. Any design must keep
those two facts intact.

## What Changes

- **Add three structured name columns to `User`:** `lastName` (required),
  `firstName` (required), `middleName` (nullable — отчество is optional).
- **Keep `name` as the canonical, STORED display field — denormalized, not
  derived.** This is load-bearing: SAML supplies only `displayName` and has no
  parts, so a _computed_ `name` would blank out every SAML-provisioned
  (production) user. Instead `name` stays a real stored column; the admin form
  **recomputes** it from the three parts on save; SAML keeps writing `name`
  directly with `firstName/lastName/middleName = null`.
- **Display composition order = ФИО, surname-first** (decided by the user,
  2026-06-24): `"{lastName} {firstName} {middleName}"`, trimmed. Current seeds
  use Western order ("Alexey Petrov"); this change deliberately reorders the
  recomputed display name to surname-first across the app and seeds.
- **Admin Edit/Add-user form edits the three parts** with English labels
  (`Last name` / `First name` / `Middle name`) per the repo UI-strings rule;
  validation: last + first required, middle optional. On save the form sends the
  three parts plus the recomputed `name`.
- **The 30+ `name` read sites stay unchanged** — that is the entire payoff of
  keeping `name` stored. No read-path edits; the change is bounded to the write
  paths, the form, the schema, and seeds.
- **Seeds populate the parts** and keep `name` consistent with the chosen order.

## Resolved decisions (user, 2026-06-24)

1. **Display order = ФИО, surname-first.** The recomputed `name` is
   `"{lastName} {firstName} {middleName}"`. Existing seed displays reorder from
   "Alexey Petrov" to surname-first; this is intended.
2. **Existing records are fully rebuilt, not migrated.** Per the MVP "Database
   Is Disposable" rule the plan reshapes the schema and `migrate reset` +
   reseeds; there is NO alter-table backfill of old `name` values. Every seeded
   user is recreated with the three parts populated. SAML-provisioned rows that
   appear after launch keep `name` only, parts `null`, until edited in the admin
   form.

## Impact

- Affected specs:
  - `structured-user-name` (NEW capability — all requirements ADDED).
- Affected code (implemented by Work 3, not here):
  - `prisma/schema.prisma` — `User` gains `lastName`, `firstName`, `middleName`.
    No FTS change (User has no `searchTsv`; the admin user search is client-side
    over `name`).
  - `packages/shared/src/schemas/report.schema.ts` — `adminUserSchema` gains the
    three parts; `AdminUser` type follows.
  - `apps/web/src/lib/mappers/admin-form-inputs.ts` — `AdminUserFormInput` +
    `toAdminUserInput` carry the parts and recompute `name`.
  - `apps/web/src/components/admin/users-tab.tsx` — form fields + the Name table
    column source.
  - `apps/web/src/components/admin/mock-data.ts` — `MockUser` gains the parts.
  - `apps/api/src/modules/admin/admin-snapshot-write.queries.ts` — user
    create/update writes the parts + `name`.
  - `apps/api/src/modules/admin/admin-snapshot.queries.ts` — read mapping
    surfaces the parts.
  - `apps/api/src/modules/auth/auth.routes.ts:213-231` — SAML user create/update
    keeps `name: profile.displayName`, parts default `null` (the concrete
    parts-are-null touchpoint).
  - `prisma/seed.ts`, `prisma/seed-simple.ts`, `prisma/seed-demo.ts`,
    `prisma/seed-constants.ts` — split single-string names into parts.
  - Tests across the above.
- Not changed: the 30+ `name` read sites; Project/report FTS; print template;
  SAML profile schema (still single `displayName`).
- MVP freedom used: schema is reshaped directly and the single init migration is
  kept in sync (`migrate reset`), per "Database Is Disposable" — no incremental
  alter-table migration.
