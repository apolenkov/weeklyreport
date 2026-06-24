# Design — structured user name parts (ФИО)

## Context

`User.name` is a single `String` and the canonical display name. Two hard
constraints shape the design:

1. **SAML supplies only a single `displayName`** (`saml-profile.ts:29`,
   provisioned at `auth.routes.ts:213-231`). It has no name parts and is the
   production identity path.
2. **`name` is read in 30+ places** (web components, reports, sections, lead
   identity). Touching all of them is out of proportion to the ask.

## Decision 1 — `name` stays a stored, denormalized field (NOT derived)

`name` remains a real `String` column. The three parts are _additional_ columns.
On the admin write path the form recomputes `name` from the parts and stores it.
On the SAML path `name` is written directly from `displayName` and the parts are
left `null`.

- **Why not derive `name` from parts?** SAML has no parts. A computed/virtual
  `name` would render empty for every SAML-provisioned production user. Storing
  `name` keeps every existing read site and the SAML flow working untouched.
- **Trade-off:** `name` and the parts can drift if a writer sets one without the
  other. Mitigated by funnelling the only part-aware writer (the admin form
  mapper) through `toAdminUserInput`, which always emits both together.
- **Rejected alternative:** SAML best-effort-splits `displayName` on whitespace
  so `name` could be truly derived. Lossy on single-token / "Unknown User"
  names and guesses patronymic incorrectly; rejected.

## Decision 2 — display composition order is ФИО (surname-first)

`name = [lastName, firstName, middleName].filter(Boolean).join(" ")`.

- Matches the explicit "surname, name, patronymic" framing of the request.
- **Visible effect:** seed displays move from "Alexey Petrov" to "Petrov Alexey
  …". Stated as an Open Question so the user can keep Western order at sign-off;
  the spec's default is surname-first.

## Decision 3 — required vs optional parts

- `lastName`, `firstName` — required (`min(1)`), replacing today's single
  `name.min(1)` validation.
- `middleName` — nullable/optional; отчество is genuinely optional in Russian
  names and absent for many users.
- The recomputed `name` is therefore never empty (last + first guarantee it).

## Decision 4 — English UI labels

Form labels are `Last name` / `First name` / `Middle name` (English) per the
repo UI-strings rule — no hardcoded Cyrillic in `apps/web/src/**/*.tsx`. The
seed _data_ may still be Cyrillic; only the labels are constrained.

## Decision 5 — no FTS / no read-path change

`User` has no `searchTsv` column (FTS is on `Project` only); the admin user
search filters `name` client-side. So no FTS migration is needed and the search
keeps working on the stored `name`. The 30+ `name` read sites are explicitly
out of scope and stay as-is.

## Migration posture

MVP "Database Is Disposable": reshape `prisma/schema.prisma` directly, keep the
single init migration in sync, and `migrate reset` to re-apply. No incremental
alter-table migration. Existing rows are rebuilt from seeds.
