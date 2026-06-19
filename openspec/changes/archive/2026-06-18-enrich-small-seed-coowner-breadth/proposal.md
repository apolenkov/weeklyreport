# Broaden co-owner cross-author content across the small demo tier

## Why

After `enrich-small-seed-cross-author`, the small/default demo tier seeds only a
thin slice of foreign co-owner content: Maria carries one item + one decision on
Платформа интеграций, Igor carries one item + one decision on Внутренний BI.
When the lead (Vasily) flips the report's Mine/Everyone visibility toggle to
Everyone, only those few rows appear, so the "team picture" the toggle is meant
to demonstrate is sparse and looks like an afterthought rather than a real
shared workload.

User feedback (live demo, 2026-06-18): the lead wants current-week AND next-week
items, plus decisions, from the OTHER leads visible on the shared products they
co-own — a fuller cross-author picture across MORE sections, not just the single
item + two decisions added on 2026-06-18.

The breadth gap is the genuinely new axis here. The existing requirement only
guarantees that SOME foreign record exists; it does not guarantee that foreign
content spans both week buckets (current + next) across more than one shared
section. This change adds that guarantee.

## What Changes

- Maria (Testing co-owner) seeds a `next`-week item alongside her existing
  `current` item on Vasily's shared products, so her foreign content fills both
  week buckets the lead report renders.
- Igor (DevOps co-owner) seeds a `next`-week item alongside his existing
  `current` item on a shared product, so his foreign content also fills both
  week buckets.
- Foreign content spans more than one shared section per co-owner where the
  role applies, so the Everyone lens reads as a real shared workload.
- New foreign rows are on-track items (and decisions, which carry no severity),
  never new risks — resolved product health (Portal yellow, Integrations green,
  BI red) is unchanged.

## Out of scope

- No change to product health / `productLight`, the all-green Integrations
  anchor (`seed-all-green-example-product`), or the red BI product.
- No new risks anywhere — only on-track items and decisions are added, so no
  green→yellow or green→red flips.
- No new products or leads; the cast stays Vasily / Maria / Igor on the same
  three products.
- No change to stage-ownership shape (Vasily Development everywhere + Planning
  on BI; Maria Testing; Igor DevOps; BI Testing left vacant).
- The `middle` and `huge` tiers, `prisma/seed.ts`, and `prisma/seed-simple.ts`
  are untouched.
- Docs-only change: no app/seed code is written here.

## Impact

- Affected specs: `demo-seed-datasets` (ADDED requirement: co-owner cross-author
  content spans both week buckets across multiple shared sections in the small
  tier).
- Affected code (implemented by a follow-up change, not here):
  `prisma/seed-demo.ts` — the `SMALL_DATASET` Maria and Igor sections.
