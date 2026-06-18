# Tasks

- [x] 1. In `prisma/seed-demo.ts`, add 2–3 co-owner lead constants to the small
     tier's cast (fixed UUIDs, deterministic), reusing existing lead-id
     conventions.
- [x] 2. Re-shape `SMALL_DATASET` stage ownership: split the seven stages of
     Василий's three products across the cast so the same colleague owns the
     same stage(s) on each product (consistent, role-shaped ownership).
- [x] 3. On the internal ("eBay"-style) product, assign Василий exactly two
     stages and leave at least one stage (e.g. Testing) unowned.
- [x] 4. Seed each co-owner a minimal foreign contribution (current-week item +
     a risk or decision) on a shared product, so Everyone has real foreign rows
     to merge.
- [x] 5. Keep determinism: fixed ids/dates, no `Date.now()`/random; verify
     idempotency under `prisma migrate reset` + reseed.
- [x] 6. Gates green (typecheck/lint/test, incl. seed-determinism checks). Live
     spot-check at 1200px: as Василий, Mine shows only own stages/records;
     Everyone reveals a co-owner's locked chip and read-only foreign rows; the
     internal product shows two owned stages + one vacant.
