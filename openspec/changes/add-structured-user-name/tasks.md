# Tasks — user-record overhaul (ФИО, position, display, SAML create-only)

> One change, one implementation pass by Work 3. MVP "Database Is Disposable":
> reshape the schema directly + keep the single init migration in sync +
> `migrate reset` + reseed; no incremental alter-table migration.

## 1. Schema

- [x] 1.1 In `prisma/schema.prisma`, add to `User`: `lastName String`,
      `firstName String`, `middleName String?`, `position String?`. Keep
      `name String`.
- [x] 1.2 Keep the single init migration in sync; `migrate reset` + reseed on the
      non-prod DB. Confirm `User` has no `searchTsv` — no FTS change.

## 2. Shared contracts

- [x] 2.1 `report.schema.ts`: extend `adminUserSchema` with
      `lastName: z.string().min(1)`, `firstName: z.string().min(1)`,
      `middleName: z.string().nullable()`, `position: z.string().nullable()`.
      Keep `name: z.string().min(1)`. Confirm `AdminUser` follows.
- [x] 2.2 `saml-profile.ts`: remove `role` from `SamlProfileSchema`; update the
      threat-model comment (role REQUIRED → role absent, default viewer /
      least privilege).

## 3. Name + initials helpers (shared)

- [x] 3.1 Add shared helpers in `@customreport/shared`: `composeName` (ФИО
      surname-first), `shortName` («Баленков А.В.» / «Баленков А.»), and
      `initials` (parts → surname+given «БА»; part-less fallback → first+second
      token; single token → first two letters).
- [x] 3.2 Unit-test all three: full ФИО, no patronymic, whitespace, part-less
      fallback, single token.

## 4. Session + auth plumbing

- [x] 4.1 `auth.routes.ts` `auth.me` (`:265`): return `lastName`/`firstName`
      (+ `middleName`) for the session user.
- [x] 4.2 `session-provider.tsx`: `SessionUser` gains `lastName`/`firstName`
      (+ optional `middleName`).

## 5. SAML create-only provisioning

- [x] 5.1 `auth.routes.ts:213-231`: split into create-only — CREATE a missing
      user (`role=viewer`, `name=displayName`, parts/position `null`); for an
      EXISTING user do NOT overwrite `name`/`role`/`reportingGroupId`/parts/
      position.
- [x] 5.2 `saml.strategy.ts` `verifySamlProfile`: stop requiring/forwarding
      `role`; default provisioned users to `viewer`.
- [x] 5.3 Verify dev-login (`auth.routes.ts:404`) still sets role from its query
      param and does not touch `SamlProfileSchema`. Confirm a seeded admin
      exists so viewer-default does not lock out admin.

## 6. Admin form, table, mappers (`apps/web`)

- [x] 6.1 `admin-form-inputs.ts`: `AdminUserFormInput` + `toAdminUserInput` carry
      parts + `position` and recompute `name` via the §3 helper.
- [x] 6.2 `mock-data.ts`: `MockUser` gains parts + `position`.
- [x] 6.3 `users-tab.tsx`: replace the single `Name` input with `Last name` /
      `First name` / `Middle name` + a `Position` input (English labels);
      `openEdit` pre-fills, `emptyForm` seeds empties; `canSave` requires
      last+first (middle + position optional). Table shows the short-form name +
      a `Position` column.

## 7. Initials / surname consumers

- [x] 7.1 `nav-bar.tsx` `initialsFromName` (`:141`): use the §3 `initials` helper
      with session parts; keep the part-less fallback.
- [x] 7.2 `stage-assignment-editor.tsx:188`: replace `lead.name.split(" ")[0]`
      with the structured surname (or the §3 short form).

## 8. API write/read

- [x] 8.1 `admin-snapshot-write.queries.ts`: user create/update write parts +
      `position` + the recomputed `name`.
- [x] 8.2 `admin-snapshot.queries.ts`: surface parts + `position` in the
      `adminUserSchema.parse({...})` mapping.

## 9. Seeds

- [x] 9.1 In `seed.ts`, `seed-simple.ts`, `seed-demo.ts`, `seed-constants.ts`:
      split names into parts (surname-first), set `name` via the §3 helper,
      populate `position` where natural. Keep the seeded `admin` role.

## 10. Tests

- [x] 10.1 Shared: `adminUserSchema` requires last/first, accepts null middle +
      null position; `SamlProfileSchema` parses without role.
- [x] 10.2 Web: form renders the labeled inputs incl. Position; save gate honors
      required parts; `toAdminUserInput` recomputes `name`; table shows short
      form; nav initials = «БА».
- [x] 10.3 API: snapshot write/read round-trips parts + position; SAML CREATE
      stubs (viewer, parts null) and SAML re-login does NOT overwrite an existing
      user.

## 11. Gates + verify

- [x] 11.1 `npx prisma generate` then `pnpm typecheck`, `pnpm lint`, `pnpm test`,
      `pnpm build` all green.
- [x] 11.2 Grep changed `apps/web/src/**/*.tsx` for Cyrillic — every hit must be
      data/comment/test, never a label.
- [ ] 11.3 Live-verify: admin adds/edits a user with parts + position
      with/without patronymic; table shows short form + position; nav avatar
      shows «БА»; a SAML stub (parts null) still shows valid initials.
- [x] 11.4 Decisions locked (user, 2026-06-24): ФИО surname-first; full reseed;
      one change covering ФИО + position + display + SAML create-only.
