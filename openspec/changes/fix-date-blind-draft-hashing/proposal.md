## Why

`stableStringify` (apps/web/src/hooks/use-lead-form-autosave.ts:81) serializes
any value that is not `null`/non-object through `JSON.stringify`, and a `Date`
instance falls into that branch — but `JSON.stringify(new Date(...))` calls
`toJSON`, not the raw stable-key path, so a `Date` field is not stably keyed
at all in the way the rest of the hash is; more importantly, when a `Date`
reaches the object-branch instead (e.g. wrapped or held as a plain field
compared before serialization elsewhere), it is treated as a plain object
with no own enumerable keys and serializes as `{}`. The result: two payloads
that differ only in a decision's `deadline` produce the identical
`payloadKey`. The autosave `dirty` flag (computed from `payloadKey !==
lastSavedKey`, use-lead-form-autosave.ts:219-220) never flips, so a
deadline-only edit never autosaves and never trips the `beforeunload` warning
— the edit is silently lost on navigation.

`lead-form-draft-reconcile.ts:24` (`recordContentKey`) reuses the same
`stableStringify` to build a content-based identity key for records without a
`stableId`. Two decisions with identical text but different deadlines hash to
the same content key, so `findSavedRecord`'s content-key branch (and its
duplicate-occurrence indexing) can match the wrong saved record and swap
identities between them.

`lead-form-draft-reconcile.test.ts` has exactly one test for
`reconcileSavedIdentities`, exercising only `items` through the content-key
branch with no duplicates. `findSavedRecord`'s `stableId`-match branch, its
occurrence-index disambiguation for repeated content keys, and the
`risks`/`decisions` collections are entirely untested — the swap risk above
had no regression coverage.

## What Changes

- Give `Date` values a stable, content-preserving serialization in
  `stableStringify` (ISO-8601 via `toISOString()`) instead of falling through
  to `{}`.
- No other change to `stableStringify`'s shape (key sorting, array handling)
  or call sites — `recordContentKey` and the autosave dirty/key computations
  pick up the fix automatically since they all route through this function.
- Add regression tests pinning the previous silent-collision behavior turning
  into a real diff:
  - `stableStringify`/autosave: a payload differing only by `Date` value now
    produces a different key (dirty flips, autosave would fire).
  - `recordContentKey`/reconcile: two decisions with identical text but
    different `deadline` `Date`s no longer share a content key.
- Add missing `reconcileSavedIdentities` coverage: `stableId`-match branch,
  duplicate-occurrence indexing (two persisted records with the same content
  key resolved by occurrence order), and `risks`/`decisions` collections.

## Capabilities

### Modified Capabilities

- `lead-form-draft-module` — `stableStringify` now serializes `Date` fields
  by ISO string instead of collapsing them to `{}`, so date-only edits are
  correctly detected as dirty and correctly distinguish same-text draft
  records during save-identity reconciliation.

## Impact

- `apps/web/src/hooks/use-lead-form-autosave.ts` — `stableStringify` Date
  handling.
- `apps/web/src/hooks/use-lead-form-autosave.test.ts` (or equivalent new
  test file) — regression test for Date-bearing dirty detection.
- `apps/web/src/features/report-sections/ui/lead-form-draft-reconcile.ts` —
  no code change expected (fix is upstream in `stableStringify`); behavior
  verified via new tests.
- `apps/web/src/features/report-sections/ui/lead-form-draft-reconcile.test.ts`
  — new tests for `stableId` branch, duplicate-occurrence indexing,
  risks/decisions collections, and the deadline-collision regression.

## Non-goals

- Not changing the shape of `DraftSaveContent`, `DraftSavePayload`, or any
  Zod schema.
- Not touching the optimistic-lock `version` handling or the
  `beforeunload`/toast wiring — only the hash that feeds the existing dirty
  check.
- Not adding a general-purpose stable-serialization library; the fix stays
  scoped to `Date` since it is the only non-plain-object value currently
  reachable in `DraftSaveContent` payloads.
