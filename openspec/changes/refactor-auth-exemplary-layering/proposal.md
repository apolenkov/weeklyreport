# Refactor the auth module into an exemplary, correctly-layered module

## Why

`apps/api/src/modules/auth` is lint-clean but mixes concerns the auth module
should not own, and one of those concerns silently bypasses a durable contract.

1. **Report-period logic lives in auth routes.** `getCurrentWeekBounds` and
   `ensureWeeklyReport` (`auth.routes.ts`) compute reporting-period bounds and
   create `Report` / `ReportSection` / `ProjectStatus` rows. This is report-domain
   logic. `period/period-creator.scheduler.ts` already reaches _into_ the auth
   module to import `getCurrentWeekBounds` — a module that creates periods should
   not depend on the login route module.

2. **The lazy login-create path bypasses the period-dual-state writer.** The
   `period-dual-state` capability requires every `Report`-period writer to route
   through `period-transition.ts::buildTransition` and lists the sanctioned
   writers. `ensureWeeklyReport` does a raw `prisma.report.create({ periodStart,
periodEnd, deadline })` outside that module and is NOT in the writer list — it
   relies on the schema default for `periodState` and computes its deadline with a
   naive `setUTCHours(18)` UTC stamp instead of the timezone- and working-day-aware
   `lib/business-date.ts::computeDeadline` that the period-creator scheduler uses.
   Two creation paths, two deadline formulas.

3. **`mountAuthRoutes` is one ~215-line function** with five inline route handlers
   (the dev-login handler alone is ~95 lines), per-request-rebuilt role lookup
   dictionaries, three copies of a "require env var" helper, and the
   `"customreport_session"` cookie-name literal repeated five times. It passes the
   repo's lint thresholds only because there is no per-function line rule and the
   handler bodies are long-but-flat.

4. **Dead code.** `auth.module.ts` (`AuthModule`) is never imported or registered
   anywhere; its `createDependencies` is never called, so the passport-jwt options
   built by `jwt.strategy.ts::createJwtStrategyOptions` never become a Strategy.
   The live token-verify path is `auth.controller.ts::verifySessionToken`.

The goal is an auth module that owns only authentication, delegates
report-period creation to a single sanctioned writer in the `period` module, and
reads as small, pure, single-purpose units — a pattern the rest of the codebase
can copy.

## What Changes

- **Move `getCurrentWeekBounds`** into `lib/business-date.ts` (its natural home,
  next to `computeDeadline` / `addBusinessDays`). Both consumers — the period-
  creator scheduler and the new period factory — import it from `lib`. The
  `period → auth` import is deleted.
- **Introduce a single period-creation factory inside the `period` module**
  (`period-transition.ts`'s sanctioned boundary). It finds-or-creates the current
  reporting `Report` through `buildTransition` + `computeDeadline`, and on create
  materialises reminder rules via `policyApplicator.applyToPeriod`. Both the
  period-creator scheduler and the lazy login-create path call it, so there is
  exactly one period writer formula — same deadline, same lifecycle, same reminders.
- **Fix the lazy-path reminder asymmetry.** Today admin-create, the cron scheduler,
  and snapshot-restore all call `applyToPeriod`, but the lazy login-create path
  never did (a Phase 50-A omission predating the Phase 50-B reminder wiring), so a
  login-created period silently gets no deadline reminders. Folding `applyToPeriod`
  into the one factory closes this as a side effect of the unification.
- **Move the lead-section materialisation** (`ReportSection` + `ProjectStatus`
  rows) out of auth into the report-section domain. `period-dual-state` explicitly
  classifies lead-section save as a non-period writer, so it stays exempt.
- **`buildUserSession` delegates** period + section creation through narrow
  injected functions; the auth module no longer imports `Report` / `ReportSection`
  / `ProjectStatus` / `AppSettings` creation logic.
- **Decompose `mountAuthRoutes`** into named per-route handler functions; the
  function becomes a route-registration map only. Lift the role lookup
  dictionaries to module-level `Record<Role, …>` constants; dedup the require-env
  helper and the cookie-name literal into shared `lib` helpers/constants; remove
  `let` reassignment and in-place `Date` mutation in the moved report logic.
- **Delete the dead `auth.module.ts` and `jwt.strategy.ts`** after confirming
  (grep + tests) nothing but their own tests references them.

### Behaviour decision (requires human sign-off)

Routing the lazy login-create path through the single factory **changes the
deadline** of lazily-created periods: `computeDeadline` honours the configured
timezone and working days, whereas the old `setUTCHours(18)` stamped 18:00 **UTC**
and skipped no weekends. For a UTC+3 deployment a default Mon-start / 4-business-
day deadline moves from Fri 18:00 UTC to Fri 18:00 local (15:00 UTC, 3h earlier),
and the date shifts whenever the old naive span crossed a weekend.
`Report.deadline` has **multiple** downstream consumers, not just late-submission
gating: the auto-publisher scheduler selects drafts where `deadline + grace` has
passed (`period/auto-publisher.scheduler.ts`), reminder `fireAt` rows are
materialised from the deadline (`reminders/policy-applicator.service.ts`), and
escalation email payloads embed it (`reminders/reminders.prisma-repository.ts`).
A lazy-path deadline shift therefore moves auto-publish timing, reminder firing,
and escalation content for lazily-created periods — all must be covered by tests.
"One writer" and "byte-identical deadline" are mutually exclusive here; this
change chooses the unified, timezone-correct deadline (consistent with the team's
intent in `fix-period-datetime-tz`) and asserts the new lazy-path deadline with
tests across these consumers. The deadline-affecting step is isolated in its own
task group so it can be reverted independently of the pure layering work.

## Capabilities

### New Capabilities

- `auth-module-layering`: the auth module owns authentication only; it MUST NOT
  contain report-period or report-section persistence logic, and MUST delegate
  period creation to the single sanctioned period writer.

### Modified Capabilities

- `period-dual-state`: add the lazy login-create path to the enumerated set of
  sanctioned period writers, closing the existing raw-create gap by routing it
  through `buildTransition`.

## Impact

- **Affected code:** `apps/api/src/modules/auth/auth.routes.ts` (extraction +
  handler decomposition), `auth.module.ts` + `jwt.strategy.ts` (deleted),
  `apps/api/src/lib/business-date.ts` (gains `getCurrentWeekBounds` + a shared
  require-env / cookie-name helper), `apps/api/src/modules/period/**` (new period
  factory; scheduler switches to it), the report-section domain (gains lead-
  section materialisation in `ensure-lead-section.ts`), new shared `lib/env.ts`
  (`requireEnv`) and `lib/session-cookie.ts` (`resolveSessionCookieName`), and the
  cookie-name consumers `pdf-export` and `trpc.context`. The `trpc.context` read
  switches from a hardcoded `"customreport_session"` to the resolved name,
  fixing a latent mismatch where the read ignored `AUTH_JWT_COOKIE_NAME` while the
  set/clear paths honoured it (a no-op for every config that leaves the name at
  the default).
- **Behaviour:** authentication, provisioning, and session shape are unchanged.
  The user-resolution logic is moved **verbatim** — it stays email-first with the
  existing `samlId` fallback (`buildUserSession` is `findFirst({email}) ??
findFirst({samlId})`). Note: this is NOT pure email-as-account-key; the code has
  always carried a `samlId` fallback that the `saml-provisioning` "account key is
  the corporate email" wording does not mention. That divergence is **pre-existing
  and out of scope** here — this change neither relies on it nor fixes it, and
  deliberately does not claim to enforce email-only resolution. The only behaviour
  change is the lazy-path deadline described above.
- **Tests:** existing `auth.routes.test.ts`, `auth.controller.test.ts`,
  `auth.e2e.spec.ts`, `roles.guard.test.ts`, `saml.strategy.test.ts`, and
  `period/__tests__/lifecycle-write-gate.test.ts` must stay green; new tests cover
  the shared period factory and the new lazy-path deadline.
- **Ordering vs `harden-jwt-verify-algorithms`:** both changes touch
  `auth.controller.ts`. This change's shared `requireEnv` helper is a **generic
  presence getter**; it MUST NOT absorb `requireJwtSecret`, which stays a distinct
  function. Whichever change lands second MUST preserve the other's hardening — the
  `{ algorithms: ["HS256"] }` verify pin and the `AUTH_JWT_SECRET >= 32` check from
  `harden-jwt-verify-algorithms` must survive this refactor's dedup.
- **Out of scope:** all eslint threshold / per-folder-override work (handled in
  the `tighten-code-quality-ratchet` ratchet stream, repo-global, never per-folder);
  the JWT verify-algorithm hardening (separate `harden-jwt-verify-algorithms`
  change); removing the `samlId` resolution fallback or reconciling it with
  `saml-provisioning` (pre-existing divergence, left as-is).
