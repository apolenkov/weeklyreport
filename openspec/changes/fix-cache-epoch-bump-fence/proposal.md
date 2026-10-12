# Proposal

## Why

F540-2: the analytics cache fences stale writes with one Redis generation key.
When `invalidateByPrefix` fails to bump it, the key stays unchanged while the
matching entries are still deleted, so a computation that started before the
publish passes the compare-and-set and writes its pre-publish value back for up
to the 3600 s TTL. A bounded fake-Redis reproduction showed exactly that.

## What Changes

- An in-process invalidation counter advances synchronously at the start of
  every invalidation, before any Redis call.
- A computation that started before an invalidation in the same process skips
  its cache write, whether or not the epoch bump succeeded.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `analytics-query-correctness`: a failed epoch bump does not let an in-flight
  computation cache its result.

## Impact

`apps/api/src/infrastructure/cache/read-through-cache.ts` and its colocated
test. Callers do not change.

## Non-goals

- No cross-process fence: the deployment runs one API replica; scaling out
  needs a distributed fence first.
- No change to the failure policy of the invalidation itself: it still deletes
  matching entries, logs and counts the failed bump, and never fails its caller.
- `d37-requester-and-cache-boundaries` keeps its own unarchived requirement;
  its design.md still lists F540-2 as awaiting a native Redis window, which the
  owner of that change should point here.
