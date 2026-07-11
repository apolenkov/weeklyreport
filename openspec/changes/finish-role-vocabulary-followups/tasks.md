## 1. API auth-bridge conformance (follow-up ii)

- [x] 1.1 Confirm deny-coverage equivalence before deleting: `assertRole`'s
      test suite (`packages/shared/src/trpc/middleware/role.ts` /
      `role.test.ts`) already covers allow/deny for all 4 roles, single-role
      and array-of-roles, and UNAUTHORIZED-before-FORBIDDEN ordering, for the
      actual production code path (the 9 canonical middleware builders);
      `createRoleGuard` is not one of them and has no other caller besides
      its own test and one `auth.e2e.spec.ts` assertion
- [x] 1.2 Delete `apps/api/src/modules/auth/roles.guard.ts` and
      `roles.guard.test.ts`
- [x] 1.3 `auth.e2e.spec.ts`: remove the `createRoleGuard` import and its one
      `it("blocks access...")` assertion; rename the outer `describe` (it no
      longer covers a "roles guard")
- [x] 1.4 `user-session.ts`: retype `SamlProfile.role` from `@prisma/client`'s
      `Role` to shared `DbRole`
- [x] 1.5 `dev-login.routes.ts`: retype `DEV_LOGIN_DEFAULT_ROLE`,
      `DEV_SAML_LOGIN_ROLE`, and `resolveDevLoginIdentity`'s `role` parameter
      from Prisma `Role` to shared `DbRole`

## 2. Dev-email centralization (follow-up iv)

- [x] 2.1 `packages/shared/src/schemas/auth.ts`: add
      `DEV_LOGIN_EMAIL_BY_ROLE: Record<DbRole, string>` next to
      `ROLE_HOME_PATH`
- [x] 2.2 `apps/web/src/app/login-page-roles.ts`: re-export it as
      `DEV_EMAIL_FOR_ROLE` (keeps the existing name for `login-page.client.tsx`
      and other consumers); remove the local literal map
- [x] 2.3 `apps/api/src/modules/auth/dev-login.routes.ts`: import
      `DEV_LOGIN_EMAIL_BY_ROLE` from shared; remove the local literal map
- [x] 2.4 `prisma/seed-constants.ts`: add `HEAD_EMAIL`, `VIEWER_EMAIL`,
      `ADMIN_EMAIL`, `LEAD_1_EMAIL` constants (literal mirror — prisma's
      isolated tsconfig cannot resolve workspace packages); `SEED_USERS`
      reads from them instead of repeating the 4 literals inline
- [x] 2.5 `prisma/seed-simple.ts`: import the same 4 constants from
      `seed-constants.ts`; replace its 4 matching literal emails. Its other 10
      users and its independent `FINANCE_GROUP` topology are untouched
- [x] 2.6 No drift-guard test added. An **unseeded** mapped email fails
      clearly — `resolveDevLoginIdentity` returns `null`. A mapped email that
      resolves to the _wrong existing_ seeded user is not caught: the login
      resync at `user-session.ts` overwrites that user's role with the
      requested role. Dev/UAT DBs are disposable and reseeded via `migrate
reset`, so this is an acceptable risk, not a 404

## 3. Catalog role-token validation + landing-doc sync (follow-up v)

- [x] 3.1 `e2e/sweep/catalog-parser.mjs`: add a `CANONICAL_ROLES` literal and
      an `assertValidRole` helper; validate the top-level `role:` and every
      `access: [...]` token, throwing on an unrecognized one
- [x] 3.2 `e2e/sweep/catalog-sweep.spec.ts`: same validation in its own
      `parseCatalog`, replacing the raw `as Role` / `as Role[]` casts with a
      runtime-checked narrowing
- [x] 3.3 Sync 3 stale landing-redirect descriptions to `ROLE_HOME_PATH`:
      `e2e/catalog/viewer.yaml` (viewer → `/reports/latest`, not
      `/reports?tab=published`), `e2e/catalog/admin.yaml` (the same viewer
      line, plus `head` → `/head/dashboard` not `/admin`), and
      `apps/web/src/app/login-page.client.tsx`'s doc comment (`admin` →
      `/admin`, not `/head/dashboard`). Every other `?tab=published`
      reference (History archive-toggle) is left untouched

## 4. Spec delta

- [x] 4.1 `architecture-refactor-backlog`: MODIFY the "client permission
      model is a recorded centralization target" requirement — record all 5
      named follow-ups as closed (2 by `unify-role-label-presentation`, 3 by
      this change) instead of "stay open as separate future changes"
- [x] 4.2 `scenario-catalog`: ADD a requirement that both catalog parsers
      validate role tokens against the canonical set

## 5. Gates and verification

- [x] 5.1 `pnpm --filter @customreport/api db:generate`
- [x] 5.2 `pnpm typecheck && pnpm lint && pnpm test` — all green
- [x] 5.3 `migrate reset` + reseed with the default `seed.ts`, then
      `pnpm db:seed:simple` — both seed scripts still run clean; live-check
      `/auth/dev-login?role=viewer` lands on `/reports/latest`
- [x] 5.4 Fail-injection check: a catalog file with a bad role token makes
      `catalog-check.mjs` throw (not silently pass)
- [x] 5.5 `openspec validate finish-role-vocabulary-followups --strict`
- [x] 5.6 Adversarial review of the diff (two independent reviewers) before
      archiving
