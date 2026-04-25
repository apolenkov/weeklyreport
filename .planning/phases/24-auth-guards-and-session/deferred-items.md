# Deferred Items — Phase 24

Issues discovered during execution but out of scope for the current plan.

## Pre-existing API Typecheck Error (out of scope)

**File:** `apps/api/src/modules/period/period.contract.test.ts:65`
**Error:** `TS6133: 'userId' is declared but its value is never read.`
**Last touched by:** `24983a5 feat(17): Wave 2 — backend API endpoints for period lifecycle, weekly report, lead form`
**Discovered during:** Phase 24 Plan 01 final typecheck (Task 4)
**Why deferred:** Pre-existing error, unrelated to auth guards work. Verified by stashing my changes — error reproduces on the prior commit. Out of scope per executor scope-boundary rule.

**Recommended fix:** Prefix the unused `userId` parameter with `_` (`_userId`) or remove it from the test setup if not needed.

## Pre-existing weekly-report-page Test Failures (out of scope)

**File:** `apps/web/src/components/weekly-report/weekly-report-page.test.tsx`
**Failures:** 5 test cases — all fail with `TypeError: Cannot read properties of undefined (reading 'request')` originating in `ExportPdfButton` at line 36 (`trpc.pdfExport.request.mutationOptions(...)`).
**Discovered during:** Phase 24 Plan 01 verification (Task 4 wrap-up).
**Why deferred:** Verified pre-existing by stashing my changes and re-running — same 5 failures reproduce on the prior commit. The mock setup in this file does not stub `pdfExport.request.mutationOptions`, leading to undefined access. Out of scope per executor scope-boundary rule.

**Recommended fix:** Update the trpc mock factory in `weekly-report-page.test.tsx` to include `pdfExport: { request: { mutationOptions: () => ({}) } }`, or import a shared mock helper.

