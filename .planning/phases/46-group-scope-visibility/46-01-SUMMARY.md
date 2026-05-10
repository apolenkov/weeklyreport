# 46-01 SUMMARY — `groupScopeFilter` helper + UserSession extension

**Status:** done
**Commit:** (filled at commit time)
**Tests:** 660 → 674 (+14 unit cases for group-scope matrix)

## What changed

- `apps/api/src/lib/group-scope.ts` (new) — `groupScopeFilter(session, target)`
  returning Prisma `where` fragment. admin → `{}`; head/lead → `{ <field>: { in: [own] } }`;
  viewer → `{ <field>: { in: viewerGroupAccess } }`; viewer with empty access →
  `{ id: { in: [] } }`. Targets: `'user' | 'reportSection' | 'project'`.
- `apps/api/src/lib/group-scope.test.ts` (new) — 14 cases covering the full
  4 roles × 3 targets matrix + viewer-empty + head-with-no-group defensive
  fallback.
- `packages/shared/src/schemas/auth.ts` — `userSessionSchema` gained two
  optional fields:
  - `reportingGroupId: z.string().uuid().optional()`
  - `viewerGroupAccess: z.array(z.string().uuid()).optional()`
    Optional because (a) PDF-export synthetic session has no group context,
    (b) legacy JWTs minted before Phase 46 do not carry it.
- `apps/api/src/modules/auth/auth.routes.ts` — `buildUserSession` now
  includes `reportingGroupId: user.reportingGroupId ?? undefined` in the
  signed JWT so groupScopeFilter does not need a Prisma lookup per request
  for head/lead.
- `apps/api/src/infrastructure/trpc/trpc.context.ts` — added
  `hydrateViewerGroupAccess()` called for every authenticated request;
  no-op for non-viewer roles; for viewer queries `prisma.viewerGroupAccess`
  by `viewerUserId` and stuffs the group ids onto the session before it
  reaches procedures.

## Why no callsites yet

Per CONTEXT.md scope: 46-01 lands the helper + session shape only.
Service callsites (dashboard, archive, weeklyReport.get) are 46-02..46-04.
Audit + integration tests are 46-05.

## Verification

```
pnpm --filter @customreport/api exec tsc --noEmit         # clean
pnpm --filter @customreport/api lint                      # clean
pnpm --filter @customreport/api test -- group-scope       # 674 ✓ (group-scope.test.ts: 14 ✓)
pnpm --filter @customreport/api test                      # 674 ✓
```

## Files

- `apps/api/src/lib/group-scope.ts` (new)
- `apps/api/src/lib/group-scope.test.ts` (new)
- `apps/api/src/modules/auth/auth.routes.ts` (+5)
- `apps/api/src/infrastructure/trpc/trpc.context.ts` (+30 helper, 2 callsites)
- `packages/shared/src/schemas/auth.ts` (+18)

## Out of scope (handled by 46-02..46-05)

- Wiring helper into `reviewService.getSubmissionDashboard` (46-02)
- Wiring into `archive.list` / `archive.detail` (46-03)
- Wiring into `weeklyReport.get` (46-04)
- `audit-logger.scopeDenied` event + integration test matrix (46-05)
