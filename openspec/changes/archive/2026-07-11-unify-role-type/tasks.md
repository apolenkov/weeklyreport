## 1. Shared

- [x] 1.1 Widen `ROLE_LABEL` to `Record<Role | DbRole, string>` in `packages/shared/src/schemas/auth.ts`; note in its comment that the union keeps the map total over both axes.

## 2. Api

- [x] 2.1 Add `apps/api/src/modules/admin/db-role.type.test.ts` pinning `expectTypeOf<DbRole>().toEqualTypeOf<$Enums.Role>()`.
- [x] 2.2 Swap `authorRole` inline unions to `DbRole` in `apps/api/src/modules/report-sections/domain/lead-form-shared.ts` and `apps/api/src/modules/report-sections/infrastructure/lead-form.prisma-repository.ts`.
- [x] 2.3 Convert the six trpc test fixtures per asserted axis: `leadform-revoke.router.test.ts`, `reopen-requests.router.test.ts`, `scope-accessed-emit.test.ts`, `auth-print-gate.test.ts`, `__tests__/role-claim.contract.test.ts` (session → `Role`); `trpc.context.pdf-export.test.ts` `RequesterUser` (Prisma row → `DbRole`).

## 3. Web — persistence axis (DbRole)

- [x] 3.1 Delete `UserRole` from `apps/web/src/features/admin/model/admin-types.ts` and `apps/web/src/shared/lib/admin-mock-data.ts`; convert consumers surfaced by the compiler (at least `admin-form-inputs.ts`).
- [x] 3.2 Swap `authorRole` annotations to `DbRole` in `apps/web/src/features/report-sections/model/lead-form.ts` (two sites) and `lead-cross-author.ts`.
- [x] 3.3 Role switcher `apps/web/src/shared/ui/role-switcher.tsx`: local `Role` dies; rows/grouping/`ROLE_ORDER` type as `DbRole` (`readonly DbRole[]`).

## 4. Web — session axis (Role)

- [x] 4.1 `session-provider.tsx` role field → `Role`.
- [x] 4.2 `weekly-report-page.tsx` `CurrentRole = Role | null`.
- [x] 4.3 `last-role.ts`: delete `LastRole`; `LastRoleRecord.role: Role`; `VALID_ROLES: ReadonlySet<Role>` keeps its literal values.
- [x] 4.4 `login-page-roles.ts`: delete local `Role`; `isRole`/`getSessionRole`/`defaultRedirectFor` → shared `Role`; `DEV_EMAIL_FOR_ROLE: Record<DbRole, string>`; `devLoginHref(role: DbRole, …)`; fix the stale `emailByRole`/`auth.routes.ts` comment to point at `dev-login.routes.ts`.

## 5. Web — tests

- [x] 5.1 Convert fixtures: `alert-bar.test.tsx` (`Role | null`), `agent-review-coming-soon.test.tsx` (session → `Role`).
- [x] 5.2 Parity tests: every `sessionRoleSchema.options` member passes `isRole`; every member round-trips through last-role storage; unknown tokens still rejected.
- [x] 5.3 Completeness type test: `(typeof ROLE_ORDER)[number]` equals `DbRole`.

## 6. Prisma seeds

- [x] 6.1 `seed-constants.ts`: keep ONE literal mirror with the documented comment pointing at the `role-type` spec; `seed.ts` `toRole` parameter types from `SeedUser["role"]`.

## 7. Verification

- [x] 7.1 `pnpm --filter @customreport/api db:generate && pnpm typecheck && pnpm lint && pnpm test && pnpm format:check`
- [x] 7.2 Residual sweep: 4-member union in any order and role `z.enum` forms return only `auth.ts`, the seed mirror, e2e, and deliberate subsets; calibrate the pattern on a known-positive first.
- [x] 7.3 `openspec validate unify-role-type --strict`
