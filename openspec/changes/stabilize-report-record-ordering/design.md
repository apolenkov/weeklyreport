## Context

R193 resumed an exhaustive runtime sweep in a fresh process after a guarded
reset/reseed. The browser exposed the same 151 controls, but PostgreSQL returned
three decisions in a different relation order. The controls named
`Edit decision:1`, `:2`, and `:3` therefore retained the same structural keys
while pointing at different records. Strict genesis comparison blocked the
unsafe replay because the inventory visible text changed.

`Item`, `Risk`, and `Decision` already have a section-scoped unique `stableId`.
The write paths preserve this durable identity while their primary `id` values
may be recreated. The shared report-section include currently supplies no
relation ordering, and most canonical seed rows let the database generate a
random `stableId`; one simple decision also has a random primary ID.

## Goals and non-goals

Goals:

- make all report-section record reads deterministic by durable identity;
- make canonical seed identities reproducible across equivalent rebuilds;
- preserve the strict runtime genesis authority boundary;
- prove both the ordinary API contract and the reset/reseed continuation case.

Non-goals:

- user-controlled ranking, drag-and-drop, or a schema migration;
- deriving order from mutable text, dates, owners, impact, or SQL heap order;
- changing authorization, save semantics, or published snapshot content;
- hiding meaningful page differences from the runtime inventory.

## Decisions

### Use `stableId` as the presentation-order key

Every common report-section read orders `items`, `risks`, and `decisions` by
ascending `stableId`. The database already enforces uniqueness of `stableId`
within a section, so this is a total order without a volatile fallback. It is
also the only existing identity deliberately preserved through delete/recreate
save paths and carry-over.

Ordering by primary `id` was rejected because saves may recreate it. Ordering
by user-facing fields was rejected because ordinary edits would unexpectedly
move cards and equal content would still need an identity tie-breaker. Adding a
position column was rejected because no user-authored ordering requirement
exists and it would require a migration and write-path expansion.

### Make canonical seeded lineage explicit

Every canonical seeded item, risk, and decision receives an explicit,
deterministic `stableId`. Where a seed row already has a deterministic primary
ID, the seed may use that value as its lineage ID unless the fixture models a
specific cross-period identity. Random primary IDs in canonical seed data are
replaced with deterministic IDs. This affects test/demo data only and does not
rewrite production records.

### Preserve strict genesis equality

The continuation protocol continues to compare the complete parent-sealed and
fresh genesis objects. Diagnostics enumerate the bounded field values that
differ, but comparison semantics do not change. In particular, visible text
remains content-addressed because it prevented structurally identical ordinal
controls from being replayed against different domain records.

### Bind editable decision occurrences to durable lineage

The existing API `stableId` is carried through the decision presentation model
to a non-visible `data-record-stable-id` attribute on the corresponding edit
button. DOM inventory records that value separately from the accessible name,
control key, and locator, so a persisted `Edit decision:N` retains ordinal
addressing while its actual domain lineage is content-addressed by the inventory
asset. A newly added client-side decision has no durable identity until the
server persists it, so its transient edit control intentionally omits lineage.

Adding lineage changes authenticated canonical bytes. The continuation
wire/hash domain therefore advances from v4 to v5; v4 grants and assets cannot
prove the new binding and are rejected rather than adapted.

## Data flow

Before:

```text
PostgreSQL unordered relations
        |
        v
repository read -> mapper -> tRPC -> React card ordinal
                                      |
                                      +-> same control key can target another row
```

After:

```text
deterministic seed id + stableId
        |
        v
PostgreSQL -> orderBy stableId -> mapper -> tRPC -> React card ordinal
                    |                              |
                    +------- durable identity ----+
```

Continuation boundary:

```text
child A genesis --sealed/HMAC--> parent grant
                                   |
fresh reseed -> ordered child B genesis
                                   |
                      exact equality before replay
                         | match          | drift
                         v                v
                    restore frontier    reject + field diagnostics
```

## Load-bearing invariants

- The shared include remains the single contract for report-section reads.
- `stableId` remains unique within a section and is preserved by continuing
  record writes.
- Product ordering is determined before the React layer; the UI does not invent
  a second ordering rule.
- Runtime genesis equality, grant authority, source binding, HMAC validation,
  and content-addressed validation remain strict. The v5 inventory additionally
  authenticates optional record lineage without changing control addressing.
- Seed changes operate only on guarded disposable development/test data.

## Verification strategy

Focused static tests inspect the shared include contract and canonical seed row
builders. API tests prove the three nested relations request ascending
`stableId` ordering. Seed tests prove deterministic `id`/`stableId` output and
cover simple plus full-profile overlay records. Runtime tests prove both that a
visible-text-only ordering mismatch fails before execution and that matching
ordinal-to-lineage mappings resume while swapped lineage with otherwise
identical controls and text fails before execution.

After those tests and the repository gates pass, a clean exact-SHA canary must
cross a real parent grant, independent reset/reseed, fresh child genesis, and
frontier continuation. Unit and static evidence alone cannot close that live
condition.

## Risks and mitigations

- Existing rows can appear in a different but now stable order after rollout.
  No product-authored manual order exists, and the new order remains consistent
  across all consumers.
- A seed writer omitted from the deterministic pass could reintroduce drift.
  Inventory all item/risk/decision seed write sites and test the composed full
  profile, not only the simple writer.
- A future optimization could remove visible text from genesis. Keep a negative
  regression where controls match but semantic record order differs.

## Rollout

No migration or data rewrite is required. Land the read contract, deterministic
seed identities, and regressions atomically. A rollback reverts those source
changes; it does not require database recovery. Acceptance remains blocked until
the exact-SHA full-profile continuation canary passes.
