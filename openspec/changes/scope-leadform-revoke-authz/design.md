## Context

`leadForm.revoke` and `leadForm.revokeAllSubmitted` are `headProcedure`s that
move submitted sections back to `draft`. Both currently call `LeadFormService`
with only the client-supplied id and `ctx.session.userId`:

```
revoke(reportSectionId)            -> service.revokeSubmission(id, userId)
                                        -> repo.getSectionById(id)         [unscoped findUnique]
                                        -> repo.revokeSectionSubmission(id) [unscoped update]

revokeAllSubmitted(reportId)       -> service.revokeAllSubmitted(reportId, userId)
                                        -> repo.revokeAllSubmitted(reportId) [updateMany where reportId,status]
```

`headProcedure` only proves the caller is a head — not that the target belongs
to the head's group. A `WeeklyReport` spans every group, so `revokeAllSubmitted`
by `reportId` alone touches the whole organisation. Result: a group-A head can
revoke group-B submissions by passing a foreign id (BOLA write hole, P0-6).

The fix already exists one procedure over. `respondReopenRequest`
(`trpc.router.ts:1595`) builds `groupScopeFilter(ctx.session, "reportSection")`
and re-loads the target with a scoped `findFirst` — an out-of-group id finds
nothing and is rejected `NOT_FOUND`. `groupScopeFilter` (`apps/api/src/lib/
group-scope.ts`) returns `{}` for admin (global), `{ author: { reportingGroupId:
{ in: groupIds } } }` for head/lead/viewer, and a zero-row filter for a viewer
with no access. This change applies that same filter to the two revoke paths.

## Goals / Non-Goals

**Goals:**

- A head can revoke only sections whose author is in the head's reporting group.
- `revokeAllSubmitted` revokes only the caller's own group's submissions inside a
  multi-group report; admin stays global.
- Reuse the existing `groupScopeFilter` and the `respondReopenRequest` shape — no
  new scope mechanism, no new error taxonomy.
- A regression test that fails on the current unscoped code.

**Non-Goals:**

- Read-path scope on `leadForm` queries (owned by `repository-scope-guard` /
  `scope-accessed-audit`).
- The reopen-decision write path (already scoped via `reopen-requests`).
- Any schema, migration, or client-contract change.

## Decisions

### D1 — Thread a Prisma scope fragment, not the raw session, into the service

The service stays free of `UserSession` typing and Prisma-relation knowledge:
the router computes `groupScopeFilter(ctx.session, "reportSection")` and passes
the resulting `where` fragment down. This matches how scope already crosses the
router→data boundary elsewhere and keeps `LeadFormService` testable with a plain
object.

Alternative — pass `ctx.session` into the service and let it call
`groupScopeFilter`: rejected. It couples the service to auth types and the
relation-path knowledge that the helper deliberately centralises.

### D2 — Scope the LOAD with a relation filter, then write by scalar id

Verified constraint: a top-level `updateMany.where` does NOT accept a to-one
relation filter (`author: { reportingGroupId: { in } }`). The whole repo bears
this out — every `updateMany` / `deleteMany` filters on scalar columns only, and
`respondReopenRequest` itself scopes via a **scoped `findFirst`** (relation
filters ARE supported on reads) and then runs a **scalar `updateMany` by the
validated id**. This change mirrors that exact pattern.

`revokeSubmission`: load the target with a scoped `findFirst({ where: { id,
...scope } })` (relation filter on the read). A null result — out-of-group OR
genuinely missing — throws `LeadFormDomainError`, which the error-mapper already
maps to tRPC `NOT_FOUND` (no existence oracle, no new mapper branch). NOTE: the
current code throws a **plain `Error`** here, which finding P1-7 shows surfaces
as a 500; this change switches it to the typed `LeadFormDomainError` so the
404 contract actually holds. Then flip via scalar `updateMany({ where: { id,
status: "submitted" } })` on the validated id, so the status precondition stays
race-safe without needing a relation filter in the write.

Alternative — relation filter inside the write `updateMany`: rejected, Prisma
does not support it at the top level (verified against repo usage + Prisma docs).

### D3 — `revokeAllSubmitted`: scoped `findMany` of ids, then scalar bulk write

Same constraint, same pattern. Inside the existing `$transaction`: first
`findMany({ where: { reportId, status: "submitted", ...scope }, select: { id:
true } })` (relation filter on the read collects only the in-scope submitted
section ids), then `updateMany({ where: { id: { in: ids }, status: "submitted" }
})` (scalar write). The scalar write keeps the `status: "submitted"` predicate —
mirroring D2's single-path write — so a section a concurrent transaction already
revoked between the `findMany` and the `updateMany` is not re-stamped with this
caller's `revokedAt` / `revokedBy`; the original single bulk `updateMany` carried
this same predicate, so this is parity, not a new guard.
For a head `scope` is `author: { reportingGroupId: { in: [groupA] } }`; for admin
`scope` is `{}` so the `findMany` collects every submitted section (unchanged).
`revokedCount` is the `updateMany` count: in the race-free case it equals the
in-scope id count, and in the rare concurrent-revoke case it is `≤` that count
(only rows still `submitted` at write time are flipped and counted).

Alternative — keep one `updateMany` with the scope spread into its where:
rejected for the same relation-filter reason as D2.

### Before / After data flow

```
BEFORE  head(A) -> revoke(B-section-id)        -> 200, group-B section -> draft   [BUG]
        head(A) -> revokeAllSubmitted(report)  -> all groups' sections -> draft   [BUG]

AFTER   head(A) -> revoke(B-section-id)        -> NOT_FOUND, no row mutated
        head(A) -> revokeAllSubmitted(report)  -> only group-A sections -> draft
        admin   -> either                       -> global, unchanged
```

## Risks / Trade-offs

- [`getSectionById` is shared with other callers] → do NOT change its signature;
  add a scoped `findFirst` load (or a `scope` param defaulting to `{}`) used only
  by the revoke path, so `fillFrom` / reopen reads keep their current behavior.
- [Scope fragment shape must match the Prisma model relations] → reuse
  `groupScopeFilter(..., "reportSection")` verbatim; it already encodes
  `author.reportingGroupId` and is unit-tested. It is only ever spread into a
  READ (`findFirst` / `findMany`), never into a write `updateMany`.
- [Plain `Error` would surface as 500, not 404 (finding P1-7)] → throw the typed
  `LeadFormDomainError`, which the error-mapper already maps to `NOT_FOUND`; no
  new mapper branch, no plain `Error` on this path.
- [Silent regression if a future head procedure skips scope] → the
  role-coverage gate proves middleware, not object scope; the regression test is
  the teeth here.

## Migration Plan

Pure code change. No migration, no flag, no destructive op. Deploy with the
normal gates (`pnpm typecheck && pnpm lint && pnpm test && pnpm build`). Rollback
is a straight revert; no data was reshaped. The MVP disposable-DB freedom is not
used (no schema touch).

Invariants: preserves the role-coverage gate (procedures keep their canonical
middleware chains), the period dual-state writers, the destructive-db guard, and
the deferred-feature pattern (none touched). It tightens the existing group-scope
invariant onto a write path it previously missed.

## Open Questions

- None. The scope helper, the target relation, and the reference pattern
  (`respondReopenRequest`) are all settled in-repo.
