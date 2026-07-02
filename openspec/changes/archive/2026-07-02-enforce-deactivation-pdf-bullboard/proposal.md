## Why

When an admin deactivates a user, the intent is immediate ejection — a stale
JWT must not keep working until it expires. The regular tRPC session path
enforces this (Redis `isRevoked` fast-path + Prisma `isActive` authoritative
check), but two auth paths skip it entirely: PDF-export session rebuild and the
Bull Board queue-admin guard. A deactivated-but-not-deleted head keeps PDF
export for the token's ~5-min window and keeps queue admin (view/retry/remove
jobs) for the JWT's ~1h TTL. See backlog `BL-DEACTIVATION-BYPASS` (P1) in
`docs/repo-excellence-review-2026-06-28.md`.

## What Changes

- Add one shared deactivation-enforcement helper in `apps/api/src/modules/auth/`
  that mirrors the regular path's two-tier semantics: Redis revoked-set
  fast-path (fail-open on Redis outage), then Prisma `isActive` authoritative
  check (fail-closed when `isActive=false`).
- Call the helper in `buildPdfExportSession` (the `requestedBy` path): a
  deactivated requester yields `null`, so the auth middleware rejects.
- Call the helper in the Bull Board `requireHead` guard: a deactivated head is
  rejected with 401 instead of passing on role alone. This requires resolving
  `PrismaService` and `SessionRevocationService` from Nest DI (`_app.get`) in
  `mountBullBoard` and making the guard async.
- Refactor the regular tRPC session path to call the same helper, so all three
  sites share one source of truth (an extraction with one intentional fix, not a
  third copy). The helper additionally treats a missing/null `User` row as
  barred (fail closed): today's regular-path check `if (userRow &&
!userRow.isActive)` fails OPEN for a hard-deleted user, and admin
  snapshot-restore hard-deletes users without adding them to the revoked set, so
  a deleted user keeps a live session for the JWT TTL. This is the only
  observable regular-path behavior change; the revoked and `isActive=false`
  outcomes are unchanged.

## Non-goals

- No change to the legacy no-`requestedBy` PDF session (it resolves no real
  user; out of scope).
- No change to which roles may reach `/admin/queues` (the "allow admin for
  parity" idea is deferred — tracked as an open question in design).
- No change to the deactivate/activate admin flow itself or to
  `SessionRevocationService`'s Redis ownership.

## Capabilities

### New Capabilities

- `session-deactivation-enforcement`: every authenticated entry path that
  rebuilds or admits a session from a JWT MUST re-check the user's
  revoked/deactivated state against the shared helper before granting access,
  with consistent two-tier (Redis fast-path, Prisma authoritative) semantics.

### Modified Capabilities

- `dependency-currency`: the "Bull Board Mount Survives the v8 Migration
  Behaviorally Unchanged" requirement currently mandates the `requireHead` auth
  middleware stay byte-identical to its pre-upgrade form. This change adds a
  MODIFIED delta that supersedes only that byte-identical auth-middleware clause
  (so `requireHead` can go async and gain the deactivation check) while keeping
  the route, base path, queue construction, and adapter wiring unchanged.

## Impact

- `apps/api/src/infrastructure/trpc/trpc.context.ts` — `buildPdfExportSession`
  plus the regular session path refactored onto the shared helper.
- `apps/api/src/infrastructure/bullmq/bull-board.module.ts` — `requireHead`
  becomes async, gains DI for Prisma + revocation service.
- New helper file under `apps/api/src/modules/auth/`.
- No schema change, no migration, no client/API contract change.
