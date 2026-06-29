# Design — refactor-auth-exemplary-layering

## Context

The auth module is the login surface (SAML callback, dev-login, logout, session
cookie issuance). Over several phases it accreted report-period logic because
`buildUserSession` needs a lead to have an active section at login time. That
logic now duplicates and partially contradicts the `period` module's
period-creation path. This change separates the layers and unifies the period
writer, without touching authentication behaviour.

## Key decisions

### D1 — `getCurrentWeekBounds` moves to `lib/business-date.ts`

It is a pure, side-effect-free UTC week-bounds function. `business-date.ts`
already owns the period/deadline date vocabulary (`computeDeadline`,
`addBusinessDays`, `workingDaySet`). Co-locating removes the `period → auth`
import and gives both the scheduler and the new factory one import source.

- Signature unchanged: `getCurrentWeekBounds(date = new Date(), periodLengthDays = 7)`.
- Its existing tests move with it (currently in `auth.routes.test.ts`).
- Trade-off: `business-date.ts` is Luxon-based; `getCurrentWeekBounds` stays
  hand-rolled UTC `Date.UTC` arithmetic. We keep it as-is (it is correct and
  tested) rather than rewrite it in Luxon — a rewrite would be unrequested scope
  and risk a regression in a function the scheduler depends on.

### D2 — one period-creation factory inside the `period` module

`period-dual-state` requires every `Report`-period writer to go through
`period-transition.ts::buildTransition`, and a CI gate fails the build on a raw
`report.create`/`report.update` of a governed lifecycle field outside the Period
transition module. The factory therefore lives **inside** the `period` module
(alongside `period-creator.scheduler.ts` and `period-transition.ts`).

Shape (illustrative, not binding on the implementer):

```
// period/period-factory.ts (inside the sanctioned boundary)
ensureCurrentPeriod(prisma, now, settings) -> { reportId, periodStart, periodEnd }
  // find draft Report for the week of `now` (getCurrentWeekBounds + length)
  // if absent: create via buildTransition(initialPeriodState(...)) + computeDeadline(...)
```

- `period-creator.scheduler.ts::runOnce` is refactored to call the factory for
  the create step, so the scheduler and the lazy login path share one formula.
  The scheduler keeps its own "skip when a future period exists" and
  scheduled→open flip logic — those are scheduler policy, not creation.
- The factory is added to the enumerated writer list in the `period-dual-state`
  spec (MODIFIED), making the previously-implicit lazy writer explicit and
  compliant.

### D3 — deadline behaviour change (the contestable one)

D2 forces the lazy-create deadline onto `computeDeadline`. This is a real,
user-visible behaviour change, not a compliance no-op (the deadline is an
ordinary data field; `period-dual-state` governs only the lifecycle tuple).

- **Chosen:** unify on `computeDeadline(periodStart, defaultDeadlineDays,
workingDays, defaultTimezone, 18)` — identical to what the scheduler already
  produces. Rationale: a single source of truth, and `fix-period-datetime-tz`
  shows the team treats UTC-naive deadline math as a bug.
- **Rejected:** parameterising the factory with a caller-supplied deadline so the
  lazy path keeps `setUTCHours(18)`. That preserves the duplicate formula the
  change exists to remove.
- **Mitigation:** a unit test asserts the new lazy-path deadline for a non-UTC
  `defaultTimezone`; the deadline-affecting step is its own task group, revertable
  without unwinding the layering work; the change surfaces this at the human
  sign-off gate.

### D4 — lead-section materialisation moves to the report-section domain

Creating `ReportSection` + `ProjectStatus` rows for the lead is "lead-section
save", which `period-dual-state` explicitly classifies as a non-period writer
(child rows into an already-created `Report`) and exempts. It moves to the
report-section domain and is invoked by `buildUserSession` through a narrow
injected function. Auth stops importing `ReportSection` / `ProjectStatus`.

### D5 — `mountAuthRoutes` decomposition

Each route handler becomes a named module-level function
(`handleSamlLogin`, `handleSamlCallback`, `handleLogout`, `handleDevLogin`);
`mountAuthRoutes` only wires `expressApp.<verb>(path, handler)`. The dev-login
role dictionaries (`emailByRole`, `nameByRole`, `samlIdByRole`,
`redirectByRole`) and `validRoles` lift to module-level `Record<Role, string>` /
`readonly Role[]` constants — typed exhaustively by `Role` so a new role fails to
compile rather than silently missing an entry.

### D6 — shared helpers, immutability, dead-code removal

- A single `requireEnv(env, key)` helper in `lib` replaces the three copies
  (`auth.controller.ts`, `jwt.strategy.ts`→deleted, `saml.strategy.ts`).
- A single `SESSION_COOKIE_NAME` resolution (`env.AUTH_JWT_COOKIE_NAME ??
"customreport_session"`) replaces the five literals; logout reuses
  `createSessionCookie(... maxAge:0)` instead of hand-building the clear-cookie
  string, so the cleared cookie matches the set cookie's attributes.
- The moved report logic is rewritten without `let` / in-place `Date` mutation
  (`deadline.setUTCDate`/`setUTCHours` → pure construction).
- `auth.module.ts` and `jwt.strategy.ts` are deleted after grep + test
  confirmation that only their own tests reference them.

## Risks / open questions

- **Regression surface is the period/deadline area** (historically regression-
  heavy). Mitigation: the full auth + `period/__tests__` suite must stay green,
  plus the new factory and deadline tests.
- **Open:** should the lazy login-create path eventually be retired entirely in
  favour of the scheduler (so login never creates a period)? Out of scope here —
  this change unifies the writer; retiring a path is a separate product decision.
- **Open:** exact home for the period factory file name and the report-section
  helper — left to the implementer within the stated module boundaries.

## Out of scope

- eslint threshold changes / per-folder overrides (→ `tighten-code-quality-ratchet`).
- JWT verify-algorithm + secret-length hardening (→ `harden-jwt-verify-algorithms`).
- The email-as-account-key rule (`saml-provisioning`, unchanged).
- Rewriting `getCurrentWeekBounds` in Luxon.
