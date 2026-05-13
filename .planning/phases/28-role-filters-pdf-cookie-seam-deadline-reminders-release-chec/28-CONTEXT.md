# Phase 28: Role Filters, PDF Cookie Seam, Deadline Reminders & Release Checklist - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning
**Mode:** Auto-generated (workflow.skip_discuss=true) — using ROADMAP phase goal as spec

<domain>
## Phase Boundary

Wave 2 of v6.0: role-scoped procedures land at the service layer, the PDF worker authenticates via short-lived cookie, leads receive T-24h reminders through react-email templates, and the release-day checklist is a commit-able artefact.

**In scope (11 REQ-IDs):**

- AUTH-04: service-layer role filtering (viewer-scoped Prisma `where` for archive.list/detail/weeklyReport.get; review.dashboard → headProcedure)
- AUTH-05: PDF cookie injection — sign 5-min scoped JWT at requestPdfExport tRPC entry; `pdf-export.processor.ts:69-72` calls `page.context().addCookies(...)` before `page.goto`
- AUTH-01 (PDF-only enable): `AUTH_DEV_MODE_ALLOW_TEST=true` staging switch (full Keycloak SAML deferred to Phase 29 per CC-1 hinge)
- NOTIF-01/03/04: T-24h deadline reminders — react-email <Tailwind> template, BullMQ pipeline reuse, idempotent dedupe key, multipart HTML+plaintext
- REL-01..05: `/CHECKLIST.md` template at repo root with sectioned signoff + handoff-sync tool to regenerate `## Pending Manual Smoke` from unticked items

**Out of scope (Phase 29+):**

- Real Keycloak SAML cut-over (Phase 29, AUTH-02)
- Frontend role-aware navigation hides (Phase 29)
- Mobile polish (Phase 30)
- AI features (Phase 31)

**CRITICAL coupling (CC-1):** AUTH-05 (PDF cookie) and AUTH-01 (`AUTH_DEV_MODE_ALLOW_TEST` staging) MUST ship in the same plan. Closing the cookie seam without the dev-mode switch causes silent 401 retry storms.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — discuss phase was skipped per workflow.skip_discuss=true. Use ROADMAP phase description, success criteria (6 items in 28-CONTEXT goal section), v6.0 ARCHITECTURE.md, and Phase 27 PHASE artifacts to guide decisions.

### Locked Decisions from Research / Phase 27

- `requireRole` factory at `packages/shared/src/trpc/middleware/role.ts` is the keystone. Phase 28 consumers: `viewerProcedure` for archive routes, `headProcedure` for review.dashboard.
- `react-email` + `<Tailwind>` for email templates (StackResearch decision; MJML rejected).
- BullMQ raw `Worker` pattern (NestJS 11 DI bug with @nestjs/bullmq 11) — reminders.scheduler reuses existing `requestReminderExecution`.
- jsonwebtoken `jwt.sign({...}, secret, { expiresIn: '5m' })` for the 5-min PDF JWT cookie.

### Phase Sequencing (suggested)

- Plan 28-01 — AUTH-04 service-layer role filters (smallest blast radius, single-file changes per route)
- Plan 28-02 — AUTH-01 + AUTH-05 PDF cookie seam (CC-1 coupled commit; AUTH_DEV_MODE_ALLOW_TEST staging + JWT signing + addCookies in processor)
- Plan 28-03 — NOTIF-01/03/04 T-24h deadline reminders (react-email template + scheduler @Cron + dedupe)
- Plan 28-04 — REL-01..05 `/CHECKLIST.md` template + handoff-sync tool

</decisions>

<code_context>

## Existing Code Insights

### Reusable Assets

- `apps/api/src/infrastructure/trpc/trpc.middleware.ts` — `headProcedure`, `leadProcedure`, `viewerProcedure`, `adminProcedure` (shipped Phase 27, AUTH-03).
- `apps/api/src/modules/pdf-export/pdf-export.processor.ts:69-72` — Playwright `page.goto` site for cookie injection.
- `apps/api/src/modules/reminders/` — existing BullMQ pipeline + `requestReminderExecution` flow.
- `apps/api/src/modules/email/` — existing nodemailer transport.

### Established Patterns

- Prisma `where` clauses with optional role-based filters (`status: 'published'` for viewer).
- BullMQ idempotency via dedupeKey: `${rule.id}:${kind}:${cycleDate}:${recipientEmail}`.
- tRPC procedure migration from `protectedProcedure` → `viewerProcedure` / `headProcedure` is contract-preserving (Phase 27 confirmed export name preservation).

### Integration Points

- Phase 29 (AUTH-02) consumes `AUTH_DEV_MODE_ALLOW_TEST` flag for the SAML cut-over.
- Phase 30 (analytics) and Phase 31 (AI) consume `headProcedure` from Phase 28's role filters.
- Existing integration suite (Phase 27 21/21 green) verifies role-filter service contracts.

</code_context>

<specifics>
## Specific Ideas

- **AUTH-05 cookie seam:** the JWT must include `reportId` claim so the PDF worker's render request validates against the right resource. 5-min expiry is enough for a single export job.
- **NOTIF-01:** the existing `requestReminderExecution` already handles dedupe; only the kind='deadline' rule fires the new T-24h schedule.
- **REL-01..05:** `/CHECKLIST.md` items map 1:1 to `.planning/REGRESSION-TEST-SCENARIOS.md` rows. `tools/handoff-sync.ts` is a new TS script that grep-parses unticked items and rewrites `HANDOFF.md ## Pending Manual Smoke` section.
- **CC-1 enforcement:** plan 28-02 commit message must explicitly state both AUTH-05 and AUTH-01-PDF land together.

</specifics>

<deferred>
## Deferred Ideas

- Full Keycloak SAML cut-over — Phase 29 (AUTH-02).
- Frontend role-aware nav (`<RoleGate>` component, hidden links) — Phase 29 (AUTH-06/07).
- Email reminder escalation chain — Phase 29 (NOTIF-05).
- WebSocket / live email status — out of scope for v6.0.

</deferred>
