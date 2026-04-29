---
phase: 28-role-filters-pdf-cookie-seam-deadline-reminders-release-chec
plan: 02
type: summary
status: complete
requirements: [AUTH-05, "AUTH-01 (PDF-only enable via AUTH_DEV_MODE_ALLOW_TEST)"]
commit: 42672a9c3187a7c8289a4c92d37142db5986f78e
cc1_coupled: true
---

# 28-02 SUMMARY — PDF cookie seam + AUTH_DEV_MODE_ALLOW_TEST (AUTH-05 + AUTH-01 PDF)

## CC-1 enforcement

Single atomic commit ships AUTH-05 + AUTH-01-PDF. `git log -1` includes literal "AUTH-05" AND "AUTH-01":

> feat(28-02): PDF cookie seam + AUTH_DEV_MODE_ALLOW_TEST staging (AUTH-05 + AUTH-01 PDF, CC-1 coupled)

## File-by-file diff

| File | What changed |
| --- | --- |
| `apps/api/src/modules/pdf-export/pdf-export.service.ts` | New `signPdfExportToken(reportId)` method using `jsonwebtoken`; `requestPdfExport(reportId, requestedBy?, authToken?)` extended; queue payload now carries `authToken`. Lazy signing — only runs when `pdfQueue` is wired (preserves existing test paths that use no queue). |
| `apps/api/src/infrastructure/bullmq/pdf-export.processor.ts` | `PdfExportJobData` extended with `authToken: string`. `processJob` now creates a browser context, calls `pdfExportService.buildAuthCookies(authToken)` and `context.addCookies(cookies)` BEFORE `page.goto`. Failure-handler logs `<redacted>` for the token, never the value. |
| `apps/api/src/infrastructure/trpc/trpc.context.ts` | Dev-fallback branch broadened: `AUTH_DEV_MODE === 'true' OR AUTH_DEV_MODE_ALLOW_TEST === 'true'` → DEV_SESSION. Legacy AUTH_DEV_MODE preserved verbatim. |
| `apps/api/src/infrastructure/trpc/trpc.context.test.ts` | NEW. Five tests cover the four dev-mode flag combinations + invalid-cookie fallthrough. |
| `apps/api/src/modules/pdf-export/pdf-export.service.test.ts` | NEW "AUTH-05 PDF export JWT signing" describe block (5 tests): missing-secret throw, short-secret throw, claim shape, queue payload contains JWT-shaped authToken, pre-signed authToken pass-through. |
| `apps/api/src/modules/pdf-export/pdf-export.contract.test.ts` | Existing "enqueues a BullMQ job" test updated to assert `authToken: expect.stringMatching(/^eyJ/)` in the queue payload (Zod-shaped JWT regex), with `PDF_EXPORT_JWT_SECRET` env-stubbed for deterministic signing. |
| `apps/api/src/modules/pdf-export/pdf-export.integration.test.ts` | NEW "AUTH-05 cookie seam (CC-1)" describe block: integration-shaped guard against the real Prisma repo + fake queue with `AUTH_DEV_MODE=false / AUTH_DEV_MODE_ALLOW_TEST=true`. Verifies the JWT decodes to `{reportId}` claim. Full e2e (BullMQ + Playwright) is out of scope for the harness — the unit-layer floor in `pdf-export.service.test.ts` is the canonical guard. |
| `apps/api/src/infrastructure/bullmq/pdf-export.processor.test.ts` | Mocks updated for the new `browser.newContext().addCookies().newPage()` shape; `buildAuthCookies` mock added to the service stub; jobs carry `authToken: 'fake-jwt'`. |
| `.env.example` | Two new variables documented: `PDF_EXPORT_JWT_SECRET` (5-min JWT signing key), `AUTH_DEV_MODE_ALLOW_TEST` (staging path for the integration suite + PDF worker). |
| `apps/web/src/components/navigation/app-shell.tsx` | Drive-by fix: `getRoleLabel`'s `Record<Role, string>` now includes `'admin'` (Phase 27 widened `Role` to include admin). |
| `apps/web/src/lib/session-provider.tsx` | Drive-by fix: `SessionUser.role` widened to include `'admin'` so it accepts the wider `sessionRoleSchema`. |

## JWT claim shape

```ts
jwt.sign({ reportId }, process.env.PDF_EXPORT_JWT_SECRET, { expiresIn: '5m' })
// decoded → { reportId: <uuid>, iat: <number>, exp: <iat + 300> }
```

## Secret-loading path

`process.env['PDF_EXPORT_JWT_SECRET']` read at call time inside `signPdfExportToken`. Throws `PdfExportDomainError` if undefined or shorter than 16 chars. The tRPC error mapper translates this to a 500 — fail loud at request time instead of silently producing an unverifiable token.

## E2E vs unit floor decision

Per Plan 28-02 / Task 6 / Step 6.3 escape hatch: the existing `pdf-export.integration.test.ts` harness does NOT bring up BullMQ workers or Playwright Chromium. Wiring those would require ~40-60 minutes of additional fixture infrastructure (Redis worker spawn, browser launch, file-system assertions on the PDF), plus a cleanup sequence that interacts with the existing `cleanDatabase` flow. Per the plan's own acceptance criteria ("either the full e2e PDF integration test passes OR the unit-level guard proves authToken is JWT-shaped, claim {reportId} present"), I shipped the unit-level floor + an integration-shaped guard against the real Prisma repo. The full e2e bring-up is naturally Phase 29's territory once the Keycloak SAML cut-over arrives — that phase will replace the dev-mode fallback with a real verifier and the e2e PDF test becomes the canary.

## Test count delta

- After 28-01: 412 unit tests (30 files).
- After 28-02: 422 unit tests (31 files).
- Delta: +10 tests, +1 new file (`trpc.context.test.ts`).
  - +5 in `pdf-export.service.test.ts` (AUTH-05 JWT signing).
  - +5 in `trpc.context.test.ts` (dev-mode flag matrix).
  - 0 net new in `pdf-export.contract.test.ts` (existing test updated, not added).

## Pre-existing issues fixed (drive-by)

- `apps/web` typecheck was already broken on `main` since Phase 27 widened `Role` to include `'admin'`. Two consumer files (`app-shell.tsx`, `session-provider.tsx`) hadn't been updated. Per the orchestrator's constraint that EVERY commit keeps both `pnpm --filter @customreport/web typecheck` AND `pnpm --filter @customreport/api typecheck` green, I added 'admin' to the consumer types. Documented here as a deviation because the plan's `files_modified` list did not include these — but the constraint forced the change.

## Verification gates run

- `pnpm --filter @customreport/api typecheck` — exit 0.
- `pnpm --filter @customreport/web typecheck` — exit 0 (was failing before this commit).
- `pnpm --filter @customreport/api test` — 422/422 passed.
- `pnpm --filter @customreport/shared test` — 218/218 passed.
- CC-1 grep verification: `git log -1 --pretty=format:%s | grep -F "AUTH-05" | grep -F "AUTH-01"` matches.
- Phase 27 default-deny gate (`role-coverage.test.ts`) — green.
