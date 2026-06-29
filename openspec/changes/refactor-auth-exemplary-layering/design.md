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
ensureCurrentPeriod(prisma, anchorDate, now, settings, policyApplicator?)
  -> { created, reportId, periodStart, periodEnd, deadline, periodState }
  // bounds = getCurrentWeekBounds(anchorDate, length); the lazy path passes
  //   anchorDate=now, the scheduler passes the day after the last period's end
  // find draft Report for those bounds; if found, return it (created:false)
  // if absent: create via buildTransition("create", {periodStart, now}) +
  //   computeDeadline(...); apply reminders only when deadline > now
  // on create conflict: catch P2002 on "Report_one_open_per_boundary", re-read, return existing
```

- The factory returns the full created/found shape — including `deadline` and
  `periodState` — because the scheduler needs them for its log/audit payload
  (`period-creator.scheduler.ts:149-164`). A `{reportId, periodStart, periodEnd}`-
  only return would silently drop those.
- **The factory materialises reminder rules on create, when the deadline is in
  the future.** When (and only when) it creates a new `Report` whose deadline has
  not yet passed, the factory calls `policyApplicator.applyToPeriod(created)`
  (idempotent upsert). This folds reminder-policy materialisation into the single
  creation point, so every creator gets it and none can forget — see D2b. The
  `deadline > now` guard is load-bearing: the reminders scheduler fires any active
  rule whose `fireAt` is already past (verified: `findDueDeadlineRules` filters
  `fireAt: { lte: now }` with no lower bound), so a period minted AFTER its own
  deadline (a late weekend first-login) would otherwise blast a stale reminder on
  the next tick. Such a period is past its deadline anyway, so skipping its
  reminders is correct. `policyApplicator` is injected into the factory the same
  optional way the scheduler holds it, so tests without a reminder mock still pass.
- `period-creator.scheduler.ts::runOnce` is refactored to call the factory for the
  create step. The factory now owns `applyToPeriod`, so the scheduler DROPS its own
  `policyApplicator.applyToPeriod(created)` call (the factory did it). The scheduler
  KEEPS its `logger.log` line and its `auditLogger.periodAutoCreate({... deadline,
... periodState})` event — those are scheduler policy, not creation. It also keeps
  its "skip when a future period exists" and scheduled→open flip logic.

### D2b — fix the lazy-path reminder-rule asymmetry (exemplary cleanup)

Today two period creators call `applyToPeriod` (the period-creator cron and admin
snapshot restore), but the lazy login-create path (`ensureWeeklyReport`,
Phase 50-A) does NOT — it predates the Phase 50-B/TD-06 wiring of reminder policy
into period creation and was never updated. (Admin manual create also does not
call `applyToPeriod` — a separate, pre-existing gap left out of scope here; this
change describes only what it touches.) The result
is a latent bug: when a lead login is the FIRST to create the current period
(scheduler off or not yet ticked), that period gets no `ReminderRule` rows and its
deadline reminders never fire. `applyToPeriod` was designed to be called by every
creator (idempotent upsert), so the lazy path is simply a missed call site. Routing
both creators through the one factory (D2) — which calls `applyToPeriod` on create —
removes the asymmetry as a side effect of unifying the writer. Edge case to test:
a created period whose deadline is already in the past must not retroactively
schedule reminders for elapsed `fireAt` instants beyond what the scheduler already
guards.

- The factory is added to the enumerated writer list in the `period-dual-state`
  spec (MODIFIED), making the previously-implicit lazy writer explicit and
  compliant.

### D2a — concurrent-create race on the partial-unique index

`Report` carries a partial unique index `Report_one_open_per_boundary` (schema.prisma:223,
`ON (periodStart, periodEnd) WHERE periodState='open'`). Two creators racing —
two concurrent lead logins, or a login racing the period-creator cron — can both
pass the find step and both attempt a create; one wins, the other gets a Prisma
`P2002`. The factory MUST catch **only** `P2002` whose target is
`Report_one_open_per_boundary`, re-read the now-existing row by
`(periodStart, periodEnd, periodState='open')`, and return it; any other error
re-throws. (Codex cited a `period-uniqueness-constraint` spec that does not exist;
the constraint itself is real and lives in the schema/init migration — the race
handling is the substantive requirement, not a spec reference.)

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

The current code does `findUnique` then `create` in two calls — a TOCTOU window
where two concurrent logins of the **same** lead can both miss and both create,
hitting the `ReportSection_reportId_authorId_key` unique index. The moved
`ensureLeadSection(reportId, userId)` MUST close it: either an `upsert` on
`(reportId, authorId)`, or a `create` that catches the unique-violation `P2002`
and re-reads. `ProjectStatus` rows already use `createMany({ skipDuplicates })`,
so they are safe; the section create is the gap to fix.

### D5 — `mountAuthRoutes` decomposition

Each route handler becomes a named module-level function
(`handleSamlLogin`, `handleSamlCallback`, `handleLogout`, `handleDevLogin`);
`mountAuthRoutes` only wires `expressApp.<verb>(path, handler)`. The dev-login
role dictionaries (`emailByRole`, `nameByRole`, `samlIdByRole`,
`redirectByRole`) and `validRoles` lift to module-level `Record<Role, string>` /
`readonly Role[]` constants — typed exhaustively by `Role` so a new role fails to
compile rather than silently missing an entry.

### D6 — shared helpers, immutability, dead-code removal

- A single **generic** `requireEnv(env, key)` presence helper in `lib` replaces
  the three "throw if missing" copies (`auth.controller.ts`, `jwt.strategy.ts`→
  deleted, `saml.strategy.ts`). It MUST stay generic: `requireJwtSecret` (which the
  `harden-jwt-verify-algorithms` change extends with a `>= 32` length check) is a
  **distinct** function layered on top of `requireEnv`, not folded into it. If
  `harden-jwt-verify-algorithms` has already landed, the dedup MUST preserve its
  length check and the `jwt.verify` `{ algorithms: ["HS256"] }` pin — see the
  ordering note in the proposal.
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
