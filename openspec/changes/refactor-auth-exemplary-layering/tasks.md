# Tasks — refactor-auth-exemplary-layering

## 1. Move the pure week-bounds helper to lib (no behaviour change)

- [ ] 1.1 Move `getCurrentWeekBounds` from `auth.routes.ts` into
      `apps/api/src/lib/business-date.ts`, signature unchanged
      (`(date = new Date(), periodLengthDays = 7)`).
- [ ] 1.2 Move its tests from `auth.routes.test.ts` into the business-date test file.
- [ ] 1.3 Update `period/period-creator.scheduler.ts` to import it from `lib`;
      delete the `period → auth` import.
- [ ] 1.4 Grep-confirm no remaining import of `getCurrentWeekBounds` from
      `modules/auth/**`. Run `pnpm typecheck`.

## 2. Single period-creation factory inside the period module

- [ ] 2.1 Add a period factory in `apps/api/src/modules/period/` (sanctioned
      `buildTransition` boundary): find-or-create the current-week draft `Report`,
      creating via `buildTransition(initialPeriodState(...))`. It must NOT create
      lead sections.
- [ ] 2.2 Refactor `period-creator.scheduler.ts::runOnce` to use the factory for
      its create step; keep its skip-when-future-period and scheduled→open logic.
- [ ] 2.3 Add a unit test for the factory: creates via `buildTransition` (both
      lifecycle representations set), and is idempotent when a period exists.
- [ ] 2.4 Confirm `period/__tests__/lifecycle-write-gate.test.ts` and the raw-write
      CI gate still pass (the factory is inside the module, so the gate accepts it).

## 3. Deadline unification (ISOLATED, behaviour-changing, revertable) — needs sign-off

- [ ] 3.1 In the factory, compute the deadline via
      `lib/business-date.ts::computeDeadline(periodStart, settings.defaultDeadlineDays,
    settings.workingDays, settings.defaultTimezone, 18)` — identical to the
      scheduler — replacing the old naive `setUTCDate(+N)` + `setUTCHours(18)` UTC stamp.
- [ ] 3.2 Add a test asserting the lazy-path deadline under a non-UTC
      `defaultTimezone` (e.g. UTC+3): lands on the working-day-correct local 18:00,
      NOT 18:00 UTC.
- [ ] 3.3 Confirm late-submission gating tests (which read `Report.deadline`) still
      pass with the new deadline.

## 4. Move lead-section materialisation out of auth

- [ ] 4.1 Move the `ReportSection` + `ProjectStatus` create logic into the
      report-section domain as a narrow function (`ensureLeadSection(reportId, userId)`).
- [ ] 4.2 `buildUserSession` calls the period factory (task 2) then this function
      through injected dependencies; remove all `Report` / `ReportSection` /
      `ProjectStatus` / `AppSettings` imports from the auth module that the move orphans.
- [ ] 4.3 Update `auth.routes.test.ts` to the new seams; keep `buildUserSession`
      assertions (admin/lead/dev-login resync) green.

## 5. Decompose mountAuthRoutes + immutability + dedup

- [ ] 5.1 Extract each route body into a named module-level handler
      (`handleSamlLogin`, `handleSamlCallback`, `handleLogout`, `handleDevLogin`);
      `mountAuthRoutes` becomes route registration only.
- [ ] 5.2 Lift `emailByRole` / `nameByRole` / `samlIdByRole` / `redirectByRole` and
      `validRoles` to module-level constants, typed `Record<Role, string>` /
      `readonly Role[]` (exhaustive over `Role`).
- [ ] 5.3 Add a shared `requireEnv(env, key)` helper in `lib`; replace the copies in
      `auth.controller.ts` and `saml.strategy.ts`.
- [ ] 5.4 Add a shared cookie-name resolution; logout reuses
      `createSessionCookie(token="", maxAge:0)` instead of a hand-built clear string.
- [ ] 5.5 Remove `let` / in-place `Date` mutation in all moved/refactored code.

## 6. Delete dead code

- [ ] 6.1 Grep-confirm `AuthModule` (`auth.module.ts`) is never imported/registered
      and `createDependencies` is never called outside its own tests.
- [ ] 6.2 Grep-confirm `createJwtStrategyOptions` (`jwt.strategy.ts`) is consumed only
      by the dead `createDependencies`.
- [ ] 6.3 Delete `auth.module.ts` and `jwt.strategy.ts` and their now-orphaned tests.

## 7. Gates

- [ ] 7.1 `pnpm typecheck && pnpm lint && pnpm test` all green.
- [ ] 7.2 Re-run `openspec validate refactor-auth-exemplary-layering --strict`.
- [ ] 7.3 Confirm no new file exceeds the repo size/complexity thresholds; auth files
      are smaller and single-purpose than before.
