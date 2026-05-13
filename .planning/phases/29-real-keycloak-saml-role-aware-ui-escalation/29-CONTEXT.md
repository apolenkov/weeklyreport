# Phase 29: Real Keycloak SAML, Role-Aware UI & Escalation - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning
**Mode:** Auto-generated (workflow.skip_discuss=true) — using ROADMAP phase goal as spec

<domain>
## Phase Boundary

Wave 3 of v6.0: production runs against real Keycloak IdP with 4-role JWT, UI hides what each role cannot reach, missed deadlines page the head exactly once per cycle.

**In scope (8 REQ-IDs):**

- AUTH-01 (full Keycloak SAML in production): SAML SSO is the only auth path; `AUTH_DEV_MODE` removed from non-test code; mock IdP container in `docker-compose.test.yml`
- AUTH-02: JWT role claim from Keycloak SAML attribute mapper (lead/head/admin/viewer); ctx.user.role populated for every tRPC procedure
- AUTH-06: navigation hides — app-shell.tsx hides `/admin` + `/head/*` for non-head; `/lead/*` for viewers via useSession()
- AUTH-07: SSR layout-level gate — `apps/web/src/app/(app)/{admin,head,lead,reports}/layout.tsx` read session via cookies() + auth.me, render 403 page on role mismatch
- AUTH-08: structured audit events from AppLoggerImpl — `{event, userId, role, attemptedRole?, ip}` for login success/fail, logout, role-denied
- NOTIF-02: T+2h `kind='escalation'` digest aggregating leads still in draft; head-only; NOT opt-outable; idempotent on `${rule.id}:escalation:${cycleDate}:${recipientEmail}`
- NOTIF-05: lead deadline reminders opt-outable via `User.notificationOptOut` flag
- NOTIF-06: BullMQ `email-reminder` rate limit `{ max: 5, duration: 60_000 }`; DLQ + admin-visible UI badge

**Out of scope (Phase 30/31):**

- Mobile polish (Phase 30)
- Trend analytics (Phase 30)
- AI features (Phase 31)

**CRITICAL ordering (CC-1):** AUTH-06 (nav hide) commits LAST. Per ROADMAP plan-note: navigation hide is cosmetic and must not ship before layout-level gate (AUTH-07) and SAML cut-over (AUTH-01) are both green, otherwise users see disabled links to pages they are still authorised to reach.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices at Claude's discretion — discuss skipped per workflow.skip_discuss=true. Use ROADMAP phase description, success criteria, v6.0 ARCHITECTURE.md, Phase 27/28 PHASE artifacts.

### Locked Decisions from Research

- @node-saml/passport-saml ^4 + Keycloak 26 IdP (per StackResearch)
- SAML attribute mapper config in Keycloak emits `role` attribute (config artefact, not code)
- AppLoggerImpl already exists with nestjs-cls correlation IDs (Phase 26)
- BullMQ rate limit: `Queue('email-reminder', { defaultJobOptions: { rateLimiterKey: 'email' }, ... })` + worker `concurrency` + `limiter: { max: 5, duration: 60_000 }`

### Phase Sequencing (suggested)

- Plan 29-01 — AUTH-08 audit logging (small, no dependencies on auth changes)
- Plan 29-02 — AUTH-02 JWT role claim from SAML attribute mapper (foundation for AUTH-07)
- Plan 29-03 — AUTH-07 SSR layout-level role gates + 403 page
- Plan 29-04 — AUTH-01 full Keycloak SAML cut-over + mock IdP in docker-compose.test.yml (`AUTH_DEV_MODE_ALLOW_TEST=true` becomes integration's only switch)
- Plan 29-05 — NOTIF-02/05/06 escalation digest + opt-out + rate limit + DLQ badge
- Plan 29-06 — AUTH-06 navigation hides (LAST per CC-1)

</decisions>

<code_context>

## Existing Code Insights

### Reusable Assets

- `apps/api/src/infrastructure/auth/` — existing SAML strategy from v2.0
- `apps/api/src/infrastructure/logging/app-logger.impl.ts` — AppLoggerImpl with nestjs-cls
- `apps/api/src/infrastructure/trpc/trpc.context.ts` — context shape, `session: UserSession | null`
- `apps/api/src/modules/reminders/reminders.scheduler.ts` (Phase 28) — extend with escalation cron
- `apps/api/src/modules/email/templates/deadline.template.tsx` (Phase 28) — pattern for escalation.template.tsx
- `apps/web/src/components/navigation/app-shell.tsx` — current nav (hard-coded links)
- `packages/shared/src/schemas/auth.ts` — sessionRoleSchema includes 'admin' (Phase 27 widening)

### Established Patterns

- Idempotent dedupe: `${rule.id}:${kind}:${cycleDate}:${recipientEmail}`
- @Cron('0 \* \* \* \*') hourly scheduler shape
- BullMQ raw Worker pattern (NestJS 11 DI workaround)
- 403 Next.js: `notFound()` is for 404; use custom 403 page or `redirect()` + flash error

### Integration Points

- Phase 28 plans 28-01..28-04 are dependencies (role middleware factory, role filters, deadline reminders)
- Phase 30 (analytics) consumes role data for head-only dashboards
- Phase 31 (AI) consumes head-only summary procedures

</code_context>

<specifics>
## Specific Ideas

- **AUTH-01 cut-over:** docker-compose.test.yml mock IdP (use `quay.io/keycloak/keycloak:26` with realm-export.json fixture). Production uses corp Keycloak; test/CI uses mock.
- **AUTH-07 SSR gate:** layout.tsx is async server component, calls `auth.me` via tRPC server-side caller (NOT client hook). 403 page is a sibling layout file at `apps/web/src/app/_403/page.tsx` or inline in each layout.
- **AUTH-08 audit:** new `audit.logger.ts` wrapper around AppLoggerImpl that emits a `{event, userId, role, attemptedRole?, ip}` envelope. Integration test asserts viewer→/admin produces `role-denied` log line.
- **NOTIF-02 escalation:** new escalation.template.tsx; new ReminderRuleKind 'escalation' (already in enum per Phase 28 finding); scheduler queries `WHERE status='active' AND kind='escalation' AND fireAt <= now()` once per hour at T+2h boundary.
- **NOTIF-06 rate-limit:** BullMQ Worker `limiter: { max: 5, duration: 60_000 }`; failed jobs go to DLQ; admin UI badge reads DLQ count.

</specifics>

<deferred>
## Deferred Ideas

- Multi-IdP support (only Keycloak SAML for v6.0)
- Audit log persistence to DB (file rotation only for v6.0)
- WebAuthn / passkey alternative auth (out of scope)
- Email reminder template editor UI (admin can only see flag, not edit templates)

</deferred>
