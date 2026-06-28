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
`ReportSectionReadModel`; filtering its product-scoped collections by a
product-id set mirrors the proven `getCrossAuthorContent` path and keeps the SQL
in the repository. The filter MUST cover every product-scoped collection the
read model exposes, not just the obvious record lists:

- `items` (current and next week), `risks`, `decisions`;
- per-stage statuses;
- the `projects` array — each entry carries `projectName`, `trafficLight`,
  `ownedStages`, and `stageSet`, so an unshared product's whole card and stage
  grid leak unless its entry is dropped;
- `referencedProjects` — recompute it from the FILTERED row set (or filter it to
  the shared-product ids), never carry it over from the unfiltered section, or a
  removed unshared row re-leaks its product name.

Alternative considered — push the filter into `getSectionForPeriod` via an
optional `restrictToProductIds`. Rejected: `getSectionForPeriod` is also the
own-section and reopen-context read; adding a scope arg there risks narrowing
those callers by mistake. Keep the foreign-only filter at the one call site that
needs it.

### D2: Filter the content collections, not section identity

The returned section-identity fields (`status`, `readOnly`, `canRequestReopen`,
`reopenBlockedReason`) are preserved; only the product-scoped content
collections are filtered. "Content collections" here is the full set from D1 —
`items`, `risks`, `decisions`, per-stage statuses, the `projects` array, and
`referencedProjects` — not just the record lists. A cross-author view is already
`readOnly` and never `canRequestReopen` (`isOwnSection` is false), so no
eligibility logic changes.

### D3: One shared non-archived set drives BOTH the gate and the filter; empty set falls back to own section

The current gate uses `hasSharedProduct`, which counts ANY shared product —
including archived ones — while the filter (mirroring `getCrossAuthorContent`)
counts only NON-ARCHIVED shared products. That mismatch lets a reader who shares
only an archived product pass the gate and observe the foreign section's status
and metadata, even though the filter would leave the content empty.

Resolve it by computing the shared non-archived product-id set ONCE and using it
for both the authorization gate and the content filter:

- the set is non-empty → grant the cross-author read and filter every collection
  (D1) to that set;
- the set is empty → the gate does not grant the cross-author read, and
  `getByPeriod` falls back to the viewer's OWN section (the existing
  `sectionAuthorId = userId` path). No error, no foreign status or metadata.

Because one computation drives both decisions, there is no longer a window in
which the gate admits a reader the filter then empties — the race the old D3 was
written to tolerate cannot occur.

This tightens the gate relative to today's `hasSharedProduct`: archived-only
co-ownership no longer opens the foreign section. It does NOT touch the
head/admin branch, whose authorization is group-scoped, not product-scoped.

## Before / After

Before — case 3 (`lead` views co-lead B):

```
getByPeriod → hasSharedProduct(A,B)=true → getSectionForPeriod(report, B)
            → return B's FULL section (all products)
```

After — case 3:

```
getByPeriod → sharedIds = co-owned-non-archived(A,B)
            → sharedIds empty? → fall back to A's own section (no foreign read)
            → sharedIds non-empty → getSectionForPeriod(report, B)
            → return B's section with items/risks/decisions/stage-statuses,
              projects, and referencedProjects all filtered to sharedIds
```

Cases 1 (own) and 2 (head/admin) are unchanged.

## Invariants

- Preserves the role-coverage gate (no new tRPC procedure; same `getByPeriod`).
- Preserves the own-contribution posture from
  `scope-lead-report-to-own-contribution` — extends it to this read path.
- Mutates nothing in period dual-state, destructive-db guard, or deferred-feature
  pattern.

## Risks / Trade-offs

- [Filter omits a collection] → cover items, risks, decisions, per-stage
  statuses, the `projects` array, AND `referencedProjects`; the contract test
  enumerates each collection.
- [Stage statuses keyed by product] → filter stage statuses by the same
  shared-product id set so a foreign chip on an unshared product cannot surface.
- [`projects`/`referencedProjects` leak product identity] → drop unshared
  `projects` entries (with their `projectName`/`trafficLight`/`ownedStages`/
  `stageSet`) and recompute `referencedProjects` from the filtered rows.
- [Gate vs filter disagree on archived products] → derive both from one shared
  non-archived set (D3); archived-only sharing falls back to the own section.
- [Over-narrowing the own/head path] → keep the filter strictly inside the
  `lead`-cross-author branch (`requestedAuthorId && canViewOtherAuthor &&
!isHeadLike && requestedAuthorId !== userId`); the test asserts own and head
  reads stay full.

## Migration Plan

Code-only; no schema change, no migration, no flag. Ship with the contract test
green. Rollback is a straight revert — no data is written.

## Open Questions

None.
