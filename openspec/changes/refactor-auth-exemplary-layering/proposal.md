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
  reporting `Report` through `buildTransition` + `computeDeadline`. Both the
  period-creator scheduler and the lazy login-create path call it, so there is
  exactly one period writer formula.
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
`late-submission` gating reads `Report.deadline`, so this is user-visible. "One
writer" and "byte-identical deadline" are mutually exclusive here; this change
chooses the unified, timezone-correct deadline (consistent with the team's intent
in `fix-period-datetime-tz`) and asserts the new lazy-path deadline with a test.
The deadline-affecting step is isolated in its own task group so it can be
reverted independently of the pure layering work.

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
  section materialisation), and `pdf-export` / `bull-board` only if they share the
  cookie-name constant.
- **Behaviour:** authentication, provisioning, and session shape are unchanged
  (the `saml-provisioning` contract is untouched — email remains the account key).
  The only behaviour change is the lazy-path deadline described above.
- **Tests:** existing `auth.routes.test.ts`, `auth.controller.test.ts`,
  `auth.e2e.spec.ts`, `roles.guard.test.ts`, `saml.strategy.test.ts`, and
  `period/__tests__/lifecycle-write-gate.test.ts` must stay green; new tests cover
  the shared period factory and the new lazy-path deadline.
- **Out of scope:** all eslint threshold / per-folder-override work (handled in
  the `tighten-code-quality-ratchet` ratchet stream, repo-global, never per-folder);
  the JWT verify-algorithm hardening (separate `harden-jwt-verify-algorithms`
  change); any change to the email-as-account-key rule (`saml-provisioning`).
