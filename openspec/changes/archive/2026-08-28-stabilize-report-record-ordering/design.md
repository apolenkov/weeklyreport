## Context

The historical R193 browser finding exposed three decisions in a different
relation order after an equivalent guarded reset and reseed. PostgreSQL returned
unordered child relations, while one canonical decision and many seed
`stableId` values were random. The old continuation platform that discovered
the defect has since been retired; the product defect and its deterministic
repair remain valid independently of that harness.

`Item`, `Risk`, and `Decision` already have a section-scoped unique
`stableId`. Continuing records preserve that identity even when a save
recreates their primary keys.

## Goals / Non-Goals

**Goals:**

- make all report-section record reads deterministic by durable identity;
- make canonical seed identities reproducible across equivalent rebuilds;
- prove the API and seed contracts with focused deterministic tests;
- keep acceptance bounded to WeeklyReport's owned smoke contour.

**Non-Goals:**

- user-controlled ranking, drag-and-drop, or a schema migration;
- deriving order from mutable text, dates, owners, impact, or SQL heap order;
- changing authorization, write semantics, or published snapshot content;
- rebuilding a continuation protocol or exhaustive browser campaign.

## Decisions

### Use `stableId` as the presentation-order key

Every common report-section read orders `items`, `risks`, and `decisions`
by ascending `stableId`. The database already enforces uniqueness within a
section, so this is a total order without a volatile fallback. It is also the
existing identity preserved through delete/recreate save paths and carry-over.

Ordering by primary `id` was rejected because saves may recreate it. Ordering
by user-facing fields was rejected because ordinary edits would move cards and
equal content would still need an identity tie-breaker. A position column was
rejected because no user-authored ordering requirement exists.

### Make canonical seeded lineage explicit

Every canonical seeded item, risk, and decision receives an explicit,
deterministic `stableId`. Where a row already has a deterministic primary ID,
the seed may reuse it as the lineage ID unless the fixture models a deliberate
cross-period identity. Random primary IDs in canonical seed data are replaced
with deterministic IDs. This affects guarded development/test data only.

### Keep product verification independent of a browser campaign

Focused API contract tests prove all three Prisma relations request ascending
`stableId` order while preserving nested data. Seed tests build equivalent
simple and full profiles twice and compare their primary identities, durable
identities, and ordered collections. WeeklyReport's bounded smoke supplies one
end-to-end write, publish, and viewer read-back without owning another ordering
implementation or resuming historical runtime state.

## Data Flow

Before:

```text
PostgreSQL unordered relations
        |
        v
repository read -> mapper -> tRPC -> React card ordinal
                                      |
                                      +-> same ordinal can target another row
```

After:

```text
deterministic seed id + stableId
        |
        v
PostgreSQL -> orderBy stableId -> mapper -> tRPC -> React card ordinal
                    |
                    +-> one repeatable product order
```

## Load-Bearing Invariants

- The shared include remains the single contract for report-section reads.
- `stableId` remains unique within a section and is preserved by continuing
  record writes.
- Product ordering is determined before the React layer; the UI does not invent
  a second ordering rule.
- Period dual-state, role-coverage middleware, and authorization behavior are
  unchanged.
- Seed changes operate only on guarded disposable development/test data.

## Verification Strategy

Run the focused report-section include contract, deterministic simple/full seed
identity regressions, and changed-file lint checks. Repository-wide gates remain
owned by the final acceptance chain. Browser evidence is limited to the bounded
WeeklyReport smoke and is not required to enumerate record permutations or
recreate the historical continuation environment.

## Risks / Trade-offs

- Existing rows can appear in a different but stable order after rollout.
  No product-authored manual order exists, and every consumer now receives the
  same repeatable order.
- A future seed writer could omit a deterministic identity. The composed
  simple/full seed regressions inventory every item, risk, and decision output.
- A future query could bypass the shared include. The focused API contract pins
  all three ordered relation clauses at the shared read boundary.

## Rollout

No migration or production data rewrite is required. Land the read contract,
deterministic seed identities, and focused regressions atomically. A rollback
reverts those source changes without database recovery. Final release readiness
is governed by WeeklyReport's bounded acceptance contract, not the retired
runtime campaign.
