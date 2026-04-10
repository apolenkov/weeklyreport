---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: infrastructure-integration
status: defining-requirements
last_updated: "2026-04-10T14:00:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: CustomReport

**Project:** Team Status Reporting Web App
**Status:** Defining requirements for v2.0
**Last Updated:** 2026-04-10

---

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-10)

**Core Value:** Лиды заполняют свои секции независимо через удобную форму, система автоматически собирает единый отчёт — без конфликтов редактирования, с историей и аналитикой.

**Why this matters:** Replaces manual OnlyOffice file editing (conflicts, no history) with automated web-based reporting that teams use in parallel, no data loss, full audit trail.

**Current Focus:** v2.0 Infrastructure Integration — connect domain logic to real infrastructure

---

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-10 — Milestone v2.0 started

---

## Phase Map

1. **Phase 1: Core Report Capture** (11 requirements)
   - Lead auth + form entry (items, statuses, risks, decisions, priorities)
   - Head review dashboard
   - Draft/submit workflow

2. **Phase 2: Report Assembly & Publication** (7 requirements)
   - Portfolio status auto-aggregation
   - Report publication + web view
   - PDF export (async jobs)

3. **Phase 3: Automation & Admin** (11 requirements)
   - Email reminders + carry-over logic
   - Admin panel (users, projects, periods, schedules)
   - Report history + browsing

---

## Requirements Summary

**Total v1:** 29 requirements
**Categories:**

- AUTH (4): SAML login, roles, JWT, unauthorized redirect
- ENTRY (10): Form entry, statuses, risks, decisions, priorities, draft/submit, carry-over
- PUB (7): Portfolio assembly, publication, web view, PDF export
- ADMIN (4): User mgmt, project mgmt, period creation, email config
- NOTIF (2): Email reminders, schedule config
- HIST (2): Archive, history view

**Coverage:** 100% (all 29 mapped to phases)

---

## Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| 3 coarse phases | Each complete capability, no artificial splitting | Confirmed |
| Phase 1 first | Core data capture unblocks all downstream | Confirmed |
| BullMQ async for PDF | Prevents HTTP blocking (critical P0 pitfall) | Confirmed |
| Role-based access (lead/head/viewer) | Simple, matches org structure (6 leads + 1 head + stakeholder viewers) | Confirmed |
| Carry-over logic Phase 3 | Automation, not blocking Phase 1 (basic entry works without it) | Confirmed |

---

## Critical Success Factors

1. **Phase 1 delivery:** Lead form + head dashboard must be intuitive. Users coming from OnlyOffice expect ease-of-use.
2. **PDF async from day one:** If Phase 2 implements synchronous PDF rendering in HTTP handler, retrofitting BullMQ later is expensive.
3. **Carry-over idempotency:** If Phase 3 carry-over logic runs twice with same input, leads see duplicates. Must guard with `carriedOver: true` flag at data model level.
4. **Backend validation:** Every endpoint must re-validate with Zod (not just frontend UX). Malicious user bypassing frontend must not corrupt data.

---

## Known Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Keycloak SAML setup complexity | Phase 1 blockers (can't login = can't test) | Plan 2-3 days for SAML cert + attribute mapping; use context7 docs for @node-saml/passport-saml |
| PDF rendering quirks (Playwright) | Phase 2 schedule slip (template iteration) | Plan 2-3 days for PDF margins/fonts/CSS; test on actual target PDF (matches current OnlyOffice layout) |
| Email SMTP credentials | Phase 3 blockers (reminders don't send) | Identify corporate SMTP provider early; plan 1 day for setup (Outlook/Google Workspace expected) |
| Carry-over timezone edge case | Data corruption (items carry over at wrong time) | Store all datetimes UTC in DB; convert to user timezone at display; test carry-over in non-UTC timezone |

---

## Next Steps

All v1 milestone phases complete. Remaining operational tasks:
1. Configure live Keycloak SAML metadata/cert for production deployment
2. Set up corporate SMTP for email reminders
3. Configure PgBouncer connection pooling for production
4. Iterate on PDF template styling (margins, fonts, page breaks)

---

## Accumulated Context

### Decisions Made

- **tRPC over REST:** Type-safe API without code generation. Eliminates REST API definition boilerplate. Shared types between frontend and backend.
- **Prisma ORM:** Type-safe, excellent migrations, 3x faster queries (Prisma 7). SQLAlchemy/TypeORM alternatives considered; Prisma wins for monorepo.
- **BullMQ for async jobs:** Native NestJS support (@nestjs/bullmq). Prevents PDF/email workers from blocking HTTP threads.
- **Zod for validation:** Single source of truth. Schemas defined once in `packages/shared`, used on both frontend (UX) and backend (security).
- **Docker Compose for dev + prod:** Start simple (Compose), migrate to Kubernetes when needed. Avoids over-engineering.

### Validated Patterns

- **Async PDF generation:** User clicks → backend dispatches BullMQ job → returns job ID → frontend polls for completion → download when ready. No HTTP blocking.
- **Carry-over idempotency:** Mark items `carriedOver: true` when moved. On next run, query only `carriedOver: false`. Idempotent at data model level.
- **Backend re-validation:** Frontend validates with Zod for UX (fast feedback). Backend ALWAYS re-validates every endpoint (security gate).
- **Stateless NestJS instances:** All state in PostgreSQL + Redis. Can run 2+ NestJS instances behind load balancer.

### Known Gaps to Address

1. **Keycloak SAML details:** @node-saml/passport-saml + Keycloak certificate exchange. Needs planning before Phase 1 starts.
2. **Email SMTP provider:** Identify corporate SMTP (Outlook, Google Workspace, etc.). May affect Phase 3 credential setup.
3. **PgBouncer configuration:** Production will use PgBouncer for connection pooling. Local dev can use direct PostgreSQL. Plan environment-specific configs.
4. **PDF styling custom CSS:** Playwright rendering differs from browser. Expect 2-3 days iteration on PDF template (margins, fonts, page breaks).

---

*State initialized: 2026-04-06*
