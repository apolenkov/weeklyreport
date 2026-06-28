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
- The regular path's observable behavior is unchanged — this is an extraction,
  not a behavior change there.

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
=== false` bars the user). This reproduces today's regular-path order and
failure modes verbatim, so the extraction cannot regress the
"Redis outage must not lock out all users" invariant.

### D3: Bull Board gains DI and goes async

`mountBullBoard(_app)` already receives `INestApplication`. It will resolve
`PrismaService` via `_app.get(PrismaService)` and construct a
`SessionRevocationService` the same way `createContextFactory` does
(`trpc.context.ts` lines 178-183). `requireHead` becomes an `async` handler;
the helper call sits after `verifySessionToken` and the `role === "head"`
check, denying with 401 on a barred user. Express 5 awaits async handlers and
forwards rejections, so the existing `try/catch` still maps a thrown verify to 401.

### Before / after data flow

```text
PDF export (requestedBy path)
  before: verify token -> findUnique(id,email,name,role,group) -> hydrate -> session
  after:  verify token -> isUserAccessBarred(requestedBy)? -> if barred: null
                       -> else findUnique -> hydrate -> session

Bull Board /admin/queues
  before: verify JWT -> role==head? -> next()
  after:  verify JWT -> role==head? -> await isUserAccessBarred(userId)? 401 : next()

Regular tRPC session (unchanged behavior)
  before: isRevoked() inline + findUnique(isActive) inline -> reject if barred
  after:  await isUserAccessBarred(userId) -> reject if barred   (same outcome)
```

### Invariants

- Preserves: the deactivation-ejection invariant ("stale JWT cannot bypass
  deactivation") — now extended to PDF + Bull Board.
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
- [Constructing a second `SessionRevocationService` in `mountBullBoard`] →
  acceptable: it is a thin ioredis wrapper with `lazyConnect`; `onModuleDestroy`
  cleanup is per-instance. If duplication is undesirable later, the singleton
  can be lifted to a Nest provider — out of scope here.

## Migration Plan

- Pure code change; no DB migration, no env change, no client change.
- Deploy is a standard API rollout. Rollback is reverting the commit; no data
  to undo.

## Open Questions

- Should `/admin/queues` also admit `admin` role for parity (the finding's
  secondary suggestion)? Deferred — it is an authz-policy decision separate from
  deactivation enforcement and would muddy this change. Track separately if
  wanted.
