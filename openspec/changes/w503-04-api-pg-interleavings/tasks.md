# Tasks

## C2139

- [x] 1.1 RED: `test-env.redis-isolation.test.ts` fails on the current unit
      defaults without contacting them.
- [x] 1.2 Unit contour sets an unresolvable `REDIS_HOST`; the same test passes.

## PostgreSQL interleavings (after their REDs)

- [x] 2.1 C0707/C0724 positive control: restore vs targeted group create
      rolls back with a typed conflict.
- [x] 2.2 C1665 positive control: a publication committing between the
      lineage reads stays locked.
- [x] 2.3 C0976 RED, then one REPEATABLE READ control read.
- [x] 2.4 C1219, C0766 and C1805 are covered by existing PostgreSQL tests
      (single-active-reopen :413, admin integration :282/:337, published
      tie order); no new test.
- [ ] 2.5 Six gates and independent review.
