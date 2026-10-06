# Tasks

## 1. Shared canonical identity

- [x] 1.1 Export `normalizeEmail` (trim + lowercase) from the shared snapshot-integrity module and reuse it in the email uniqueness comparator.
- [x] 1.2 Surface `normalizeEmail` through the `@customreport/shared` barrel.

## 2. Write boundaries

- [x] 2.1 Admin `upsertUser` persists the normalized email on create and update; `samlId` stays the verbatim input email.
- [x] 2.2 Snapshot restore `upsertUsers` persists the normalized email on create and update; `samlId` stays the verbatim snapshot email.
- [x] 2.3 SAML provisioning stores the normalized email on create and looks the account up case-insensitively; `samlId` lookup stays exact.
- [x] 2.4 `isUserUniqueViolation` recognizes `User_email_lower_key`; the admin unique-violation conflict mapping covers the new index.

## 3. Database invariant

- [x] 3.1 Add a forward migration that fails on existing `lower(email)` duplicates (bounded id listing) and creates `UNIQUE INDEX "User_email_lower_key" ON "User" (lower("email"))`.
- [x] 3.2 Document the migration-owned functional index on `User.email` in `prisma/schema.prisma`; keep the exact-case `@unique`.

## 4. Regression coverage

- [x] 4.1 Unit coverage: writers persist normalized email; SAML lookup issues a case-insensitive email filter; case-variant + foreign `samlId` still refuses.
- [ ] 4.2 API database-boundary regression on a guarded disposable database: first create wins, a case-variant second write is a typed conflict, and the exported snapshot parses and restores. Deferred — requires a live database.
