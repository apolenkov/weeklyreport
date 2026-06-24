# Tasks — add-structured-user-name

> Implemented by Work 3 in its own worktree/branch. MVP "Database Is Disposable":
> reshape the schema directly + keep the single init migration in sync +
> `migrate reset`; no incremental alter-table migration.

## 1. Schema

- [ ] 1.1 Add to `User` in `prisma/schema.prisma`: `lastName String`,
      `firstName String`, `middleName String?`. Keep `name String`.
- [ ] 1.2 Keep the single init migration in sync with the schema; `migrate reset`
      to re-apply on the non-prod DB. Confirm `User` has no `searchTsv` — no FTS
      change.

## 2. Shared contract

- [ ] 2.1 In `packages/shared/src/schemas/report.schema.ts`, extend
      `adminUserSchema`: add `lastName: z.string().min(1)`,
      `firstName: z.string().min(1)`, `middleName: z.string().nullable()`
      (optional). Keep `name: z.string().min(1)`.
- [ ] 2.2 Confirm `AdminUser` type (inferred) now carries the parts; update any
      direct constructors of the type.

## 3. Name composition helper

- [ ] 3.1 Add a single shared helper that composes the display name in ФИО order
      (`[lastName, firstName, middleName].filter(Boolean).join(" ").trim()`),
      so the form mapper, seeds, and any future writer share one definition.
      Place it where both web mapper and seeds can import (e.g.
      `@customreport/shared`).
- [ ] 3.2 Unit-test the helper: full ФИО, no middle name, surrounding whitespace.

## 4. Admin form + table (`apps/web`)

- [ ] 4.1 In `admin-form-inputs.ts`: extend `AdminUserFormInput` with the parts;
      `toAdminUserInput` emits `lastName`, `firstName`, `middleName`, and a
      recomputed `name` (via the §3 helper).
- [ ] 4.2 In `mock-data.ts`: add the parts to `MockUser`.
- [ ] 4.3 In `users-tab.tsx`: replace the single `Name` input with `Last name`
      / `First name` / `Middle name` inputs (English labels). `openEdit`
      pre-fills from the parts; `emptyForm` seeds empty parts.
- [ ] 4.4 Update `canSave` so last + first are required; middle optional.
- [ ] 4.5 Keep the table `Name` column reading the stored `name` (no other read
      site changes). The client-side search keeps filtering `name`.

## 5. API write/read

- [ ] 5.1 `admin-snapshot-write.queries.ts`: user `create`/`update` write the
      three parts plus the (already-recomputed) `name` from the payload.
- [ ] 5.2 `admin-snapshot.queries.ts`: surface the parts in the
      `adminUserSchema.parse({...})` mapping.
- [ ] 5.3 `auth.routes.ts:213-231` (SAML): keep `name: profile.displayName`;
      leave the three parts unset (`null`). Verify create + update branches.

## 6. Seeds

- [ ] 6.1 Split single-string names into parts in `seed.ts`, `seed-simple.ts`,
      `seed-demo.ts`, `seed-constants.ts`; set `name` via the §3 helper in
      ФИО / surname-first order. Existing records are fully rebuilt via
      `migrate reset` + reseed — no alter-table backfill of old names.

## 7. Tests

- [ ] 7.1 Shared: `adminUserSchema` requires last/first, accepts null middle.
- [ ] 7.2 Web: form renders three labeled inputs; save gate honors required
      parts; `toAdminUserInput` recomputes `name`.
- [ ] 7.3 API: snapshot write/read round-trips the parts; SAML write leaves
      parts null with `name` from `displayName`.

## 8. Gates + verify

- [ ] 8.1 `npx prisma generate` then `pnpm typecheck`, `pnpm lint`, `pnpm test`,
      `pnpm build` all green.
- [ ] 8.2 Grep changed `apps/web/src/**/*.tsx` for Cyrillic — every hit must be
      data/comment/test, never a label.
- [ ] 8.3 Live-verify in the admin Users tab: add + edit a user with/without a
      patronymic; the table shows the composed `name`.
- [x] 8.4 Display order confirmed: ФИО / surname-first (user, 2026-06-24).
      Existing records fully rebuilt via reseed — both decisions are locked.
