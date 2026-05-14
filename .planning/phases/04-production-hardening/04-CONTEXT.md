# Phase 04: Production Hardening - Context

**Gathered:** 2026-04-09
**Status:** Active follow-up after milestone implementation

## Why this phase exists

The core roadmap milestone is implemented, but real-browser/manual validation surfaced production-quality issues that are not acceptable to leave outside planning artifacts:

- hydration/runtime mismatch caused by browser-backed state being read during initial render
- no centralized system logging with rotation on the API/runtime side
- pending deep design + E2E hardening review to close production-readiness gaps

## Locked decisions

- Browser-backed pages must not read localStorage/cookie-derived state directly into initial render if that can diverge from SSR output.
- Logging must be centralized and rotation-backed, starting from `apps/api/src/main.ts` and job-like services.
- Hardening work must stay in GSD artifacts, not only in chat context.

## Known concrete seams

### Hydration risk files

- `apps/web/src/app/(app)/lead/report/page.tsx`
- `apps/web/src/app/(app)/head/dashboard/page.tsx`
- `apps/web/src/app/(app)/head/report/page.tsx`
- `apps/web/src/app/(app)/reports/[reportId]/page.tsx`
- `apps/web/src/app/(app)/reports/history/page.tsx`
- `apps/web/src/app/(app)/admin/page.tsx`
- `apps/web/src/lib/dev-session.ts`
- `apps/web/src/components/report-section/section-storage.ts`
- `apps/web/src/components/admin/admin-runtime.ts`
- `apps/web/src/components/report/report-runtime.ts`
- `apps/web/src/components/head/submission-dashboard.tsx`

### Logging insertion points

- `apps/api/src/main.ts`
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/saml.strategy.ts`
- `apps/api/src/modules/reminders/reminders.service.ts`
- `apps/api/src/modules/pdf-export/pdf-export.service.ts`
- `apps/api/src/modules/carry-over/carry-over.service.ts`
- `apps/api/src/modules/publication/publication.service.ts`
- `apps/api/src/modules/admin/admin.service.ts`

## Working approach

- `04-01`: stabilize SSR/client boundaries and remove hydration mismatches first
- `04-02`: add operational logging + close design/E2E review findings
