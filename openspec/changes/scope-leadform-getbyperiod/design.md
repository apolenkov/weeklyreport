## Context

`LeadFormService.getByPeriod(reportId, userId, role?, requestedAuthorId?)`
serves three readers of a section:

1. the section's own author (full section, read-write);
2. a `head`/`admin` viewing any author's section (full section, read-only);
3. a `lead` viewing a co-lead's section (read-only).

For case 3 the only gate is `hasSharedProduct(userId, requestedAuthorId)`, a
global boolean: if the two leads share ANY product, the service calls
`getSectionForPeriod` and returns the WHOLE mapped section. So a single shared
product exposes the co-lead's records on every product they own, including
products the viewer does not co-own.

The sibling read `getCrossAuthorContent` already does this correctly: it
computes the per-author shared-product id set and filters `items`, `risks`, and
`decisions` by `sharedIds`
(`lead-form.prisma-repository.ts:619-627`). The archived
`scope-lead-report-to-own-contribution` change locked the posture that
cross-product content is not disclosed.

## Goals / Non-Goals

**Goals:**

- Bound the `lead` cross-author branch of `getByPeriod` to the viewer/author
  shared-product set.
- Keep the own-section read and the head/admin read byte-for-byte unchanged.
- Add a contract test that fails if unshared-product records leak.

**Non-Goals:**

- No change to the Mine / Everyone visibility lens, `getCrossAuthors`, or
  `getCrossAuthorContent`.
- No change to group-scope guards or the cross-group audit event.
- No change to write/submit/reopen paths or to the `readOnly` /
  `canRequestReopen` computation (those already key off `isOwnSection`).

## Decisions

### D1: Filter in the service, reuse the repository co-ownership query

The cross-author shared-product id set is already derivable from the query
behind `getCrossAuthorContent`. Expose those shared ids for the
viewer/author pair (a small repository method or a returned field) and have the
service filter the mapped section before returning.

Rationale: the mapper `mapPrismaToReportSection` already produces the typed
`ReportSectionReadModel`; filtering its `items`/`risks`/`decisions` (and
per-stage statuses) by a product-id set mirrors the proven
`getCrossAuthorContent` path and keeps the SQL in the repository.

Alternative considered — push the filter into `getSectionForPeriod` via an
optional `restrictToProductIds`. Rejected: `getSectionForPeriod` is also the
own-section and reopen-context read; adding a scope arg there risks narrowing
those callers by mistake. Keep the foreign-only filter at the one call site that
needs it.

### D2: Filter only the records, not section identity

The returned shape (status, `readOnly`, `canRequestReopen`,
`reopenBlockedReason`) is preserved; only the content collections are filtered.
A cross-author view is already `readOnly` and never `canRequestReopen`
(`isOwnSection` is false), so no eligibility logic changes.

### D3: Empty shared set returns an empty-records section, not an error

If the co-ownership relation has narrowed to zero shared products between the
`hasSharedProduct` check and the filter, the returned section simply contains no
records. The view is still authorized (a section exists) but discloses nothing —
consistent with `getCrossAuthorContent` returning empty rows.

## Before / After

Before — case 3 (`lead` views co-lead B):

```
getByPeriod → hasSharedProduct(A,B)=true → getSectionForPeriod(report, B)
            → return B's FULL section (all products)
```

After — case 3:

```
getByPeriod → hasSharedProduct(A,B)=true → getSectionForPeriod(report, B)
            → sharedIds = co-owned(A,B)
            → return B's section with items/risks/decisions/stage-statuses
              filtered to sharedIds
```

Cases 1 (own) and 2 (head/admin) are unchanged.

## Invariants

- Preserves the role-coverage gate (no new tRPC procedure; same `getByPeriod`).
- Preserves the own-contribution posture from
  `scope-lead-report-to-own-contribution` — extends it to this read path.
- Mutates nothing in period dual-state, destructive-db guard, or deferred-feature
  pattern.

## Risks / Trade-offs

- [Filter omits a record collection] → cover items, risks, decisions, AND
  per-stage statuses; the contract test enumerates each collection.
- [Stage statuses keyed by product] → filter stage statuses by the same
  shared-product id set so a foreign chip on an unshared product cannot surface.
- [Over-narrowing the own/head path] → keep the filter strictly inside the
  `lead`-cross-author branch (`requestedAuthorId && canViewOtherAuthor &&
!isHeadLike && requestedAuthorId !== userId`); the test asserts own and head
  reads stay full.

## Migration Plan

Code-only; no schema change, no migration, no flag. Ship with the contract test
green. Rollback is a straight revert — no data is written.

## Open Questions

None.
