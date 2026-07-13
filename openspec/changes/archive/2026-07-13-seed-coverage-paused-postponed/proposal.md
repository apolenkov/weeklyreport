## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

`prisma.config.ts` targets `seed.ts` for `migrate reset` and `db:seed` — it is
the canonical dataset every dev/test DB gets by default. Its `workflowCycle`
for current-period items only ever emits `in_progress` and `done`, and every
next-period item is hardcoded to `planned`; the script never produces a
`paused` or a `postponed` item. `assertSeedCoverage` in
`prisma/seed-coverage-check.ts` — the guard that exists specifically to catch
a missing status treatment — is called by `seed-simple.ts` and `seed-demo.ts`
but never by `seed.ts`. The result: the default out-of-the-box dataset never
exercises the paused/postponed UI treatments, and the one guard meant to catch
exactly that gap is wired to seed scripts nobody runs by default, not to the
one that is.

## What Changes

- `prisma/seed.ts`: make at least one current-period item resolve to
  `ItemWorkflowStatus.paused` and at least one next-period item resolve to
  `ItemWorkflowStatus.postponed` in the active period, so the canonical
  dataset carries both statuses on every reseed. `pausedReason` stays unset
  (nullable; the UI enforces it only at the point of pausing, matching the
  existing convention in `seed-simple.ts` and `seed-demo.ts`).
- `prisma/seed.ts`: import `assertSeedCoverage` from `./seed-coverage-check.js`
  and call it at the end of `main()`, after the existing summary
  `console.log`, mirroring the call site already used in `seed-simple.ts` and
  `seed-demo.ts`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `seed-determinism`: adds a requirement that the canonical seed (`seed.ts`)
  covers the full item-status vocabulary and self-checks that coverage via
  `assertSeedCoverage`.

## Impact

- `prisma/seed.ts`
- No schema, migration, or other seed-script changes — `seed-simple.ts`,
  `seed-demo.ts`, and `seed-coverage-check.ts` are untouched.
