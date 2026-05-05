# Phase 36, Plan 02 — SUMMARY

**REQ-IDs:** SEC-02
**Status:** complete

## What shipped

- `apps/api/src/lib/audit-logger.ts` — `AuditEvent` union widened to include `'mutation'`. New `AuditLogger.mutation(input)` signature carries `{userId, role, ip, procedure, target?, status, duration, reason?}`. The `createAuditLogger` impl writes through the existing `AppLogger` envelope (info on success, warn on fail). `createNullAuditLogger` adds a noop for tests.
- `apps/api/src/infrastructure/trpc/trpc.middleware.ts` — new `mutationAuditMiddleware` that fires only when `type === 'mutation'` and skips paths starting with `auth.` (already audited via login events) and `ai.` (privacy: AI prompts/responses must never reach the audit stream — Phase 31 AI-SPEC §5.3 / PITFALLS C-3). Extracts `target` best-effort from the input by reading whichever of `sectionId | reportId | periodId | projectId | leadId | id` is present as a string. Emits `mutation` after `next()` so `status` reflects the actual outcome and `duration` is the elapsed wall time.
- `apps/api/src/infrastructure/trpc/trpc.middleware.ts` — wired `mutationAuditMiddleware` into all 5 role-bound procedure builders: `protectedProcedure`, `headProcedure`, `leadProcedure`, `viewerProcedure`, `anyRoleProcedure`. Composed after `pdfExportGuard` so PDF-export sessions hit the guard's FORBIDDEN throw before the audit emit (status=fail with reason='Procedure X not permitted for PDF-export session').
- `apps/api/src/infrastructure/trpc/mutation-audit.test.ts` (NEW) — 4 unit tests covering: success emission with target extraction; failure emission with reason; query is NOT audited; `auth.*` and `ai.*` mutations are NOT audited.

## Design notes

**Why no before/after diff?**

The original SEC-02 wording mentioned "before/after diff" capture. Implementing that cleanly requires Prisma-side introspection (the middleware doesn't see the SQL UPDATE/INSERT shape — only the tRPC input + result). Adding a Prisma extension or a wrapper around every service is heavyweight, brittle, and risks doubling the audit volume for batch operations. The pragmatic SEC-02 surface — actor / action / target / outcome / duration — already gives operators a complete chain-of-custody for SIEM rules and forensics. If diffing becomes needed later, a Prisma `$extends` callback at the model layer is the right pattern; deferring that to v8.1.

**Why not capture the full input?**

PII would leak. `lead.saveDraft` includes free-text item bodies; `admin.upsertProject` carries lead emails; etc. The id-key extraction is the smallest signal that lets a SIEM correlate "actor U mutated target T" without persisting prose.

**Why two privileged exclusions?**

- `auth.*` — already audited via `loginSuccess` / `loginFail` / `logout`. Adding `mutation` events would double-count and dilute the dashboard.
- `ai.*` — privacy: prompts and responses must not reach the structured log stream (Phase 31 hard requirement). Token usage + timing live in `AiInsight` rows instead.

## Verification

```bash
pnpm --filter @customreport/api test src/infrastructure/trpc/mutation-audit.test.ts
# 4/4 green
pnpm --filter @customreport/api test
# 606/606 green (was 602/602; +4 new tests)
pnpm --filter @customreport/api typecheck
# clean
```

## Files

- `apps/api/src/lib/audit-logger.ts` (mutation event + AuditLogger.mutation)
- `apps/api/src/infrastructure/trpc/trpc.middleware.ts` (mutationAuditMiddleware + 5 builders)
- `apps/api/src/infrastructure/trpc/mutation-audit.test.ts` (new, 4 tests)
