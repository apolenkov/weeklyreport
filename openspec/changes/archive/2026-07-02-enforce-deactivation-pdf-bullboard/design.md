## Context

The deactivate-user feature (A2, UAT-v7) promises that deactivating a user
ejects their in-flight sessions immediately, not after the JWT expires. The
regular tRPC session path keeps that promise via two tiers in
`trpc.context.ts` (lines 201-212): a Redis revoked-set fast-path
(`SessionRevocationService.isRevoked`, fail-open) followed by an authoritative
Prisma `User.isActive` read (fail-closed).

Two other JWT-admitting paths never adopted that check:

- `buildPdfExportSession` (`trpc.context.ts`) rebuilds the requester's session
  from `requestedBy` and selects only `id,email,name,role,reportingGroupId` —
  no `isActive`, no `isRevoked` call.
- Bull Board's `requireHead` (`bull-board.module.ts`) does `jwt.verify` plus a
  role check and calls `next()` synchronously — no Prisma, no revocation
  service in scope at all.

Result: a deactivated head keeps PDF export for the ~5-min PDF token window and
keeps queue admin (view/retry/remove jobs) for the ~1h session-JWT TTL. This is
backlog `BL-DEACTIVATION-BYPASS` (P1).

## Goals / Non-Goals

**Goals:**

- One shared deactivation-enforcement helper as the single source of truth for
  the revoked/deactivated decision across all three JWT-admitting paths.
- PDF-export and Bull Board fail closed for a deactivated/revoked user.
- The regular path's observable behavior is unchanged for the revoked and
  `isActive=false` cases — this is an extraction there — with one intentional
  fix: a null/missing user row now fails closed (D4) instead of fail-open.

**Non-Goals:**

- Changing the legacy no-`requestedBy` PDF synthetic session (resolves no real
  user; nothing to check).
- Changing which roles may reach `/admin/queues` (the "allow admin for parity"
  idea — see Open Questions).
- Touching `SessionRevocationService`'s Redis ownership or the
  admin deactivate/activate flow.
- Any schema change or migration.

## Decisions

### D1: A standalone helper that takes its dependencies, not a method on a service

A free function, e.g. `isUserAccessBarred(userId, prisma, sessionRevocation)`
(or `assertUserActive` returning a boolean), living under
`apps/api/src/modules/auth/`.

- Rationale: `SessionRevocationService` is deliberately Redis-only (mirrors
  `AnalyticsCache`); bolting a Prisma read onto it would muddy that ownership.
  A function that receives both collaborators keeps each dependency explicit and
  is trivial to unit-test with fakes.
- Alternative considered — add the Prisma read inside
  `SessionRevocationService`: rejected, breaks the service's single
  responsibility and forces a Prisma dependency into a class that intentionally
  has none.
- Alternative considered — a Nest guard/middleware: rejected, Bull Board mounts
  a raw Express handler outside the tRPC/Nest interceptor chain, and the PDF
  path runs inside context construction; a plain function fits both call sites
  without framework plumbing.

### D2: Two-tier semantics preserved exactly

The helper performs Redis `isRevoked` first (fail-open: a thrown/failed lookup
must NOT bar the user), then the Prisma `isActive` read (fail-closed: `isActive
=== false` bars the user, AND a null/missing row bars the user — see D4). This
reproduces today's regular-path order and the Redis fail-open mode verbatim, so
the extraction cannot regress the "Redis outage must not lock out all users"
invariant. The one deliberate divergence is the null-row case (D4), which moves
from fail-open to fail-closed.

### D3: Bull Board gains DI and goes async

`mountBullBoard(_app)` already receives `INestApplication`. It will resolve
`PrismaService` via `_app.get(PrismaService)` and likewise resolve the existing
`SessionRevocationService` via `_app.get(SessionRevocationService)`. That
service is already provided and exported by `AdminModule`
(`admin.module.ts`), so `_app.get` (non-strict, application-wide) returns the
DI-managed singleton whose `onModuleDestroy` Nest calls on shutdown. Resolving
from DI — rather than `new`-ing a fresh instance the way `createContextFactory`
does — avoids adding a third unmanaged ioredis client whose lifecycle hook would
never fire. `requireHead` becomes an `async` handler;
the helper call sits after `verifySessionToken` and the `role === "head"`
check, denying with 401 on a barred user. Express 5 awaits async handlers and
forwards rejections, so the existing `try/catch` still maps a thrown verify to 401.

### D4: A missing user row fails closed too (not only `isActive === false`)

The helper's Prisma tier bars the user when `findUnique` returns `null` OR returns
`isActive === false`. Today's regular-path check
`if (userRow && !userRow.isActive)` fails OPEN on a null row: admin
snapshot-restore hard-deletes unreferenced users via `prisma.user.delete`
(`admin-snapshot-write.queries.ts`, the `removedUserIds` loop) WITHOUT adding
them to the Redis revoked set, so the fast-path never fires and a deleted user
keeps a working session for the JWT TTL (~1h). The helper treats null as barred
(`if (!userRow || !userRow.isActive)`), which closes that gap. This is the single
intentional behavior change on the regular path; the PDF path already fails
closed on null (`buildPdfExportSession` returns `null` for a vanished requester),
and the Bull Board path is net-new, so both inherit the correct behavior for free.

### Before / after data flow

```text
PDF export (requestedBy path)
  before: verify token -> findUnique(id,email,name,role,group) -> hydrate -> session
  after:  verify token -> isUserAccessBarred(requestedBy)? -> if barred: null
                       -> else findUnique -> hydrate -> session

Bull Board /admin/queues
  before: verify JWT -> role==head? -> next()
  after:  verify JWT -> role==head? -> await isUserAccessBarred(userId)? 401 : next()

Regular tRPC session (behavior unchanged EXCEPT null-row case, D4)
  before: isRevoked() inline + findUnique(isActive) inline
          -> if (userRow && !userRow.isActive) reject   (null row = FAIL OPEN)
  after:  await isUserAccessBarred(userId) -> reject if barred
          (revoked + isActive=false: same outcome; null row now FAILS CLOSED)
```

### Invariants

- Preserves: the deactivation-ejection invariant ("stale JWT cannot bypass
  deactivation") — now extended to PDF + Bull Board, and to hard-deleted
  users on the regular path (D4: null row fails closed).
- Preserves: Redis fail-open / Prisma fail-closed two-tier behavior.
- Untouched: role-coverage gate (no tRPC procedure added), destructive-db
  guard, period dual-state, deferred-feature pattern.

## Risks / Trade-offs

- [Bull Board guard now does a Redis + Prisma round-trip per request] →
  acceptable: `/admin/queues` is a low-traffic head-only admin surface; the
  regular path already pays this on every authenticated call.
- [Async guard could change error propagation] → mitigated by keeping the
  existing `try/catch` and verifying Express 5 awaits the handler; add a test
  asserting a deactivated head gets 401.
- [Acquiring `SessionRevocationService` in `mountBullBoard`] → resolve the
  existing DI singleton via `_app.get(SessionRevocationService)`, not a fresh
  `new`. The service is already provided and exported by `AdminModule`, so its
  `onModuleDestroy` (which calls `redis.quit()`) runs on shutdown. A manually
  constructed instance would NOT get that hook called by Nest, leaking an
  ioredis handle that can keep tests and process shutdown from settling. Reusing
  the singleton also avoids a second redundant ioredis client.

## Migration Plan

- Pure code change; no DB migration, no env change, no client change.
- Deploy is a standard API rollout. Rollback is reverting the commit; no data
  to undo.

## Open Questions

- Should `/admin/queues` also admit `admin` role for parity (the finding's
  secondary suggestion)? Deferred — it is an authz-policy decision separate from
  deactivation enforcement and would muddy this change. Track separately if
  wanted.
