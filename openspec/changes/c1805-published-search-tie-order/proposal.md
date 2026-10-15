# Proposal

## Why

C1805: published search applies SQL `ORDER BY rank DESC, createdAt DESC,
reportId DESC, recordId DESC LIMIT n`, then `SearchService.query()` re-sorts the
returned rows by `rank desc, createdAt desc, id asc`. Every document of one
report carries the report's `publishedAt` as `createdAt`, so equal-rank ties are
common. When a tie straddles the limit, SQL keeps the highest `recordId`s and the
service can only reorder them: the visible top-N is not the first N under the
service order, and differs from live search, whose SQL already ends in `id ASC`.
A real-PG fixture reproduced it: three equal records, `limit=2` returned
`[102, 103]` instead of `[101, 102]`.

Backlog: TASK-503.16 (wave 2, candidate C1805).

## What Changes

- Published search SQL orders by `rank DESC, createdAt DESC, recordId ASC`, then
  `reportId ASC, recordType ASC` only to make rows with identical record ids
  deterministic. The same order applies before `LIMIT` and in the response.
- The owning SQL unit test and the real-PG tie fixture pin the order.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `viewer-published-search`: published results use one order before the limit
  and in the response.

## Impact

`apps/api/src/modules/search/published-search-query.ts`, its unit test and the
new `search.prisma-repository.published-tie-order.integration.test.ts`.

## Non-goals

- Public schema, ACL, frozen group filter, rank computation, limit semantics,
  live search and `SearchService` stay unchanged.
- This clarifies the contract for the current stage; the earlier spec did not
  promise an id-ascending top-N.
- Not covered by the fixture: ties across several reports or record types with
  identical record ids; the secondary keys are determinism only. SQL text
  comparison of `recordId` follows the database collation, which matches
  `localeCompare` for lowercase UUIDs but is not proven for other id shapes.
