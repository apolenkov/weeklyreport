# Phase 02: Report Assembly & Publication - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Source:** Roadmap + Phase 1 completion state + repo seam scan + Playwright PDF research

<domain>
## Phase Boundary

Phase 2 delivers the first stakeholder-facing publication loop on top of the
completed Phase 1 capture flow:

- portfolio overview auto-assembles from all submitted lead traffic lights
- head can review the assembled report before publication
- head can publish a report into immutable, read-only form
- viewer users can open the published report on the web
- PDF export is available from the published report flow

Phase 2 does **not** include carry-over logic, email reminders, admin CRUD,
report-period creation UX, or history browsing. Those remain in Phase 3.
</domain>

<decisions>
## Implementation Decisions

### Locked Decisions

- **D-01:** Phase 2 must build on the completed Phase 1 role/session/navigation
  surfaces instead of introducing a second auth or routing model.
- **D-02:** The current repo is still contract-shaped and partially demo/local-state
  backed. Phase 2 should introduce real publication/review contracts first,
  then wire backend/service/repository seams, then replace local-only web flows
  where needed.
- **D-03:** PDF generation must be asynchronous from day one. Use a
  BullMQ-style job boundary in backend architecture; do not generate PDFs in the
  request/response path.
- **D-04:** Playwright remains the PDF engine. HTML should be assembled from a
  narrow validated DTO/render contract; Playwright should run only in a backend
  worker/process.
- **D-05:** Phase 2 publication must produce an immutable published view. After
  publish, the report is treated as read-only for head/viewer-facing rendering.

### Agent's Discretion

- **A-01:** The exact shape of the head review experience may be minimal as long
  as it clearly separates:
  1. submission dashboard,
  2. assembled report review,
  3. published read-only view.
- **A-02:** The portfolio aggregation presentation may be a compact summary block
  or table as long as the red/yellow/green roll-up rules are obvious and tested.
- **A-03:** The PDF export transport may be implemented as a local async seam
  (job/request/result contract) before a full worker runtime exists, as long as
  the architecture stays queue-first and does not regress to synchronous export.
- **A-04:** Risks and decisions may be shown in the web review/published report if
  needed for internal readership, but PDF output must stay on an explicit field
  whitelist so export scope is deliberate rather than implicit.
  </decisions>

<code_context>

## Existing Code Insights

### Backend anchors

- `apps/api/src/modules/report-sections/*` already owns the typed lead-section
  read/save/submit model.
- `apps/api/src/modules/review/*` already owns head dashboard sorting and head-only
  access checks.
- `prisma/schema.prisma` and `prisma/seed.ts` already define the report/report-section
  domain and a deterministic active report cycle.
- `apps/api/src/main.ts` is still only a stub bootstrap; repository/runtime wiring
  is not yet fully real.

### Frontend anchors

- `apps/web/src/app/(app)/lead/report/page.tsx` +
  `apps/web/src/components/report-section/*` are the main content-render/edit seam.
- `apps/web/src/app/(app)/head/dashboard/page.tsx` +
  `apps/web/src/components/head/submission-dashboard.tsx` are the current head review seam.
- `apps/web/src/components/navigation/{app-shell,role-nav}.tsx` already provide the
  minimal role-aware route shell.
- `apps/web/src/components/report-section/section-storage.ts` and
  `apps/web/src/lib/dev-session.ts` show the current local/demo runtime seam that
  Phase 2 will likely start replacing.

### Shared contracts

- `packages/shared/src/schemas/report.ts` is the canonical place for new assembled
  report, publication, and PDF-export contracts.
- `packages/shared/src/trpc/router.ts` already has contract-style stubs and should
  remain the shared API surface, but Phase 2 needs concrete publication/report
  DTOs added there first.

### Test anchors

- Backend unit seams:
  - `apps/api/src/modules/report-sections/report-sections.service.test.ts`
  - `apps/api/src/modules/review/review.service.test.ts`
- Frontend component seams:
  - `apps/web/src/components/report-section/report-section-form.test.tsx`
  - `apps/web/src/components/head/submission-dashboard.test.tsx`
  - `apps/web/src/components/navigation/role-nav.test.tsx`
- Browser seams:
  - `apps/web/e2e/lead-report-entry.spec.ts`
  - `apps/web/e2e/head-dashboard.spec.ts`

These should be extended, not bypassed.
</code_context>

<specifics>
## Specific Ideas

- Treat Phase 2 as a three-surface UI set:
  1. review dashboard,
  2. assembled report review/publish screen,
  3. published report read-only screen (also the source for PDF-oriented rendering).
- Introduce new shared schemas for:
  - portfolio overview aggregation
  - assembled report read model
  - publish command/result
  - PDF job request/result metadata
- Prefer extracting a read-only report render component from the existing
  report-section form family rather than duplicating content rendering logic.
- Keep all new Phase 2 routes under `/head` or another already protected prefix so
  they inherit the current middleware/auth shape.
- Use print CSS with explicit page sizing, font readiness, and deterministic asset
  loading for PDF output.
  </specifics>

<deferred>
## Deferred Ideas

- History/archive browsing of published reports (Phase 3)
- Email reminder workflows and schedule management (Phase 3)
- Carry-over automation and idempotent rollover jobs (Phase 3)
- Full production worker/runtime orchestration beyond what is needed to prove the
  async PDF contract locally (later infrastructure hardening)
  </deferred>

---

_Phase: 02-report-assembly-publication_
_Context gathered: 2026-04-09 after Phase 1 completion and autonomous Phase 2 discovery_
