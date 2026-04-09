# Phase 03: Automation & Admin - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Source:** Roadmap + completed Phase 1/2 seams + Phase 3 code seam scan + scheduling/idempotency research

<domain>
## Phase Boundary

Phase 3 delivers the operational/admin layer on top of the already working
capture → publication flow:
- self-service admin CRUD for users, projects, report periods, and reminder schedules
- reminder schedule definition and reminder execution
- idempotent carry-over / rollover for next-period items and unresolved decisions
- history/archive browsing for published reports

Phase 3 must build on the completed Phase 2 publication and published-report
surfaces rather than introducing a separate reporting lifecycle.
</domain>

<decisions>
## Implementation Decisions

### Locked Decisions

- **D-01:** PostgreSQL is the source of truth for reminder schedules, carry-over state,
  and history/archive metadata. BullMQ is the delivery/execution layer, not the
  source of scheduling truth.
- **D-02:** Reminder scheduling must not depend on in-memory timers. Persist schedule
  rows and enqueue deterministic delayed jobs or scheduler-generated jobs from those rows.
- **D-03:** Carry-over logic must be idempotent at the data-model level first
  (unique constraints / persisted lineage), not only by queue retries or process locks.
- **D-04:** Archive/history browsing should read immutable published report data or
  durable published snapshots — not mutable draft/review state.
- **D-05:** Phase 3 should reuse the existing service/router split in `apps/api`
  and the role-aware route shell in `apps/web` instead of inventing parallel patterns.

### Agent's Discretion

- **A-01:** Admin CRUD may be split into multiple pages/components as long as the
  first usable slice lets head manage users, projects, periods, and reminder rules
  without direct database edits.
- **A-02:** Reminder scheduling may use one-off delayed jobs or BullMQ job schedulers,
  but job identity must remain deterministic and dedupe-safe.
- **A-03:** Carry-over lineage may be represented by dedicated tables or durable fields,
  but repeated rollover execution must remain a no-op for already-carried entities.
- **A-04:** History UX may start as a compact list/detail archive view if it fully
  satisfies browsing past published reports in sorted order.
</decisions>

<code_context>
## Existing Code Insights

### Backend anchors

- Existing backend modules already define the prevailing pattern:
  - `apps/api/src/modules/report-sections/*`
  - `apps/api/src/modules/review/*`
  - `apps/api/src/modules/publication/*`
  - `apps/api/src/modules/pdf-export/*`
- There are **no** current backend modules for admin, reminders/scheduling, or archive/history.
- `prisma/schema.prisma` already contains reusable foundations:
  - `User`
  - `Project`
  - `Report`
  - `ReportSection`
  - `Item.carriedOver`
  - `Decision.resolvedAt`
- The carry-over hook field already exists (`Item.carriedOver`), but durable rollover
  lineage/history tables do not yet exist.

### Frontend anchors

- Current web surfaces after Phase 2:
  - `apps/web/src/app/(app)/lead/report/page.tsx`
  - `apps/web/src/app/(app)/head/dashboard/page.tsx`
  - `apps/web/src/app/(app)/head/report/page.tsx`
  - `apps/web/src/app/(app)/reports/[reportId]/page.tsx`
- Role-aware shell/navigation already exists in:
  - `apps/web/src/components/navigation/app-shell.tsx`
  - `apps/web/src/components/navigation/role-nav.tsx`
- Browser-side report runtime already exists in:
  - `apps/web/src/components/report/report-runtime.ts`
- There are **no** current admin routes/components or archive/history routes/components.

### Shared contracts

- `packages/shared/src/schemas/report.ts` remains the canonical contract home.
- Current shared contracts already cover capture, review, publication, and async PDF export.
- Missing shared contracts likely needed for Phase 3:
  - admin CRUD payloads/read models
  - reminder schedule definitions and execution results
  - carry-over / rollover results
  - history/archive list/detail models

### Test anchors

- Existing API/service test style:
  - `report-sections.service.test.ts`
  - `review.service.test.ts`
  - `publication.service.test.ts`
  - `pdf-export.service.test.ts`
- Existing web/component/E2E style:
  - `report-section-form.test.tsx`
  - `submission-dashboard.test.tsx`
  - `assembled-report-review.test.tsx`
  - `published-report.test.tsx`
  - `lead-report-entry.spec.ts`
  - `head-dashboard.spec.ts`
  - `head-publication.spec.ts`
  - `published-report.spec.ts`
- There are currently **no** dedicated admin/reminder/archive tests.
</code_context>

<specifics>
## Specific Ideas

- Split Phase 3 into four dependent plans:
  1. admin + shared operational contracts
  2. reminder schedule definition + reminder execution
  3. carry-over / period rollover
  4. history/archive browsing
- Introduce durable scheduling tables first, then attach BullMQ delivery on top.
- Use deterministic `jobId` / dedupe keys for reminder execution so duplicate enqueue attempts collapse safely.
- Treat carry-over as a transaction that either creates next-period artifacts once or becomes a no-op on replay.
- Persist history/archive as immutable published report references or snapshots, not as pointers to mutable draft state.
</specifics>

<deferred>
## Deferred Ideas

- Rich audit logs beyond what Phase 3 minimally needs for admin/history traceability
- Advanced analytics over reminders, trends, and risk evolution
- External integrations beyond SMTP reminder delivery
</deferred>

---

*Phase: 03-automation-admin*
*Context gathered: 2026-04-09 after completed publication flow and Phase 3 discovery*
