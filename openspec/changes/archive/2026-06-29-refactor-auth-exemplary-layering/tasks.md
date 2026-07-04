# Tasks — refactor-auth-exemplary-layering

## 1. Move the pure week-bounds helper to lib (no behaviour change)

- [x] 1.1 Move `getCurrentWeekBounds` from `auth.routes.ts` into
      `apps/api/src/lib/business-date.ts`, signature unchanged
      (`(date = new Date(), periodLengthDays = 7)`).
- [x] 1.2 Move its tests from `auth.routes.test.ts` into the business-date test file.
- [x] 1.3 Update `period/period-creator.scheduler.ts` to import it from `lib`;
      delete the `period → auth` import.
- [x] 1.4 Grep-confirm no remaining import of `getCurrentWeekBounds` from
      `modules/auth/**`. Run `pnpm typecheck`.

## 2. Single period-creation factory inside the period module

- [x] 2.1 Add a period factory in `apps/api/src/modules/period/` (sanctioned
      `buildTransition` boundary): find-or-create the current-week draft `Report`,
      creating via `buildTransition(initialPeriodState(...))`. It must NOT create
      lead sections. It MUST return the full shape `{ reportId, periodStart,
periodEnd, deadline, periodState }` (the scheduler needs deadline + periodState
      for its audit/log payload).
- [x] 2.2 Make the factory race-safe: catch ONLY `P2002` whose target is
      `Report_one_open_per_boundary`, re-read by `(periodStart, periodEnd,
periodState='open')`, and return the existing row; re-throw any other error.
- [x] 2.3 In the factory, on create (not on find), call
      `policyApplicator.applyToPeriod(created)` (idempotent) so reminder rules are
      materialised at the one creation point. Inject `policyApplicator` optionally,
      same as the scheduler holds it.
- [x] 2.3a Refactor `period-creator.scheduler.ts::runOnce` to use the factory; DROP
      its own `policyApplicator.applyToPeriod(created)` (the factory now does it), but
      KEEP its `logger.log` line and `auditLogger.periodAutoCreate({... deadline ...
periodState})` event, plus skip-when-future-period and scheduled→open logic.
- [x] 2.3b Test the lazy-path symmetry: a login-created period gets its
      `ReminderRule` rows (the pre-fix asymmetry is gone); and a created period whose
      deadline is already in the past does not schedule reminders beyond the
      scheduler's existing elapsed-fireAt guard.
- [x] 2.4 Add factory unit tests: creates via `buildTransition` (both lifecycle
      representations set); idempotent when a period exists; concurrent-create
      (simulated `P2002`) returns the existing row, not a throw.
- [x] 2.5 Add a scheduler regression test asserting `applyToPeriod`, the log, and
      the audit event still fire with the same deadline/periodState after the refactor.
- [x] 2.6 Confirm `period/__tests__/lifecycle-write-gate.test.ts` and the raw-write
      CI gate still pass (the factory is inside the module, so the gate accepts it).

## 3. Deadline unification (ISOLATED, behaviour-changing, revertable) — needs sign-off

- [x] 3.1 In the factory, compute the deadline via
      `lib/business-date.ts::computeDeadline(periodStart, settings.defaultDeadlineDays,
settings.workingDays, settings.defaultTimezone, 18)` — identical to the
      scheduler — replacing the old naive `setUTCDate(+N)` + `setUTCHours(18)` UTC stamp.
- [x] 3.2 Add a test asserting the lazy-path deadline under a non-UTC
      `defaultTimezone` (e.g. UTC+3): lands on the working-day-correct local 18:00,
      NOT 18:00 UTC.
- [x] 3.3 Verify the deadline shift across ALL consumers, not just late-submission:
      (a) late-submission gating; (b) auto-publish selection in
      `period/auto-publisher.scheduler.ts` (`deadline + grace` cutoff); (c) reminder
      `fireAt` materialisation in `reminders/policy-applicator.service.ts`;
      (d) escalation email payload in `reminders/reminders.prisma-repository.ts`.
      Add/extend tests so a lazily-created period's new deadline drives each
      correctly.

## 4. Move lead-section materialisation out of auth

- [x] 4.1 Move the `ReportSection` + `ProjectStatus` create logic into the
      report-section domain as a narrow function (`ensureLeadSection(reportId, userId)`).
      Close the find→create TOCTOU: `upsert` on `(reportId, authorId)` or
      `create`-catch-`P2002`-reread; keep `ProjectStatus` `createMany({skipDuplicates})`.
      Add a concurrent same-lead-login test (both calls resolve to one section, no throw).
- [x] 4.2 `buildUserSession` calls the period factory (task 2) then this function
      through injected dependencies; remove all `Report` / `ReportSection` /
      `ProjectStatus` / `AppSettings` imports from the auth module that the move orphans.
- [x] 4.3 Update `auth.routes.test.ts` to the new seams; keep `buildUserSession`
      assertions (admin/lead/dev-login resync) green.

## 5. Decompose mountAuthRoutes + immutability + dedup

- [x] 5.1 Extract each route body into a named module-level handler
      (`handleSamlLogin`, `handleSamlCallback`, `handleLogout`, `handleDevLogin`);
      `mountAuthRoutes` becomes route registration only.
- [x] 5.2 Lift `emailByRole` / `nameByRole` / `samlIdByRole` / `redirectByRole` and
      `validRoles` to module-level constants, typed `Record<Role, string>` /
      `readonly Role[]` (exhaustive over `Role`).
- [x] 5.3 Add a shared GENERIC `requireEnv(env, key)` presence helper in `lib`;
      replace the copies in `auth.controller.ts` and `saml.strategy.ts`. Do NOT fold
      `requireJwtSecret` into it — keep it a distinct function. If
      `harden-jwt-verify-algorithms` already landed, preserve its `>= 32` length check
      and the `jwt.verify` `{ algorithms: ["HS256"] }` pin through the dedup.
- [x] 5.4 Add a shared cookie-name resolution; logout reuses
      `createSessionCookie(token="", maxAge:0)` instead of a hand-built clear string.
- [x] 5.5 Remove `let` / in-place `Date` mutation in all moved/refactored code.

## 6. Delete dead code

- [x] 6.1 Grep-confirm `AuthModule` (`auth.module.ts`) is never imported/registered
      and `createDependencies` is never called outside its own tests.
- [x] 6.2 Grep-confirm `createJwtStrategyOptions` (`jwt.strategy.ts`) is consumed only
      by the dead `createDependencies`.
- [x] 6.3 Delete `auth.module.ts` and `jwt.strategy.ts` and their now-orphaned tests.

## 7. Gates

- [x] 7.1 `pnpm typecheck && pnpm lint && pnpm test` all green.
- [x] 7.2 Re-run `openspec validate refactor-auth-exemplary-layering --strict`.
- [x] 7.3 Confirm no new file exceeds the repo size/complexity thresholds; auth files
      are smaller and single-purpose than before.
