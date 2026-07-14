## Why

BL-17 (P1) from `docs/reviews/repo-excellence-review-2026-07-14.md`: the two
Prisma maintenance scripts' hand-rolled Redis flush (raw RESP protocol over
`net.createConnection`, not an ioredis client) mishandle the socket-close
case in opposite, both-wrong ways.

- **`prisma/wipe-manual-uat.ts`'s `flushRedisDb`** (lines 106-148): its
  `socket.once("close", () => { clearTimeout(timer); })` handler clears the
  timeout but never calls `resolve()`. If the Redis socket closes without a
  prior `data` reply and without an `error` event, the returned promise is
  left permanently unsettled — the script hangs after the destructive
  wipe/reseed transaction has already committed, and `prisma.$disconnect()` /
  `pool.end()` (in the script's `finally`, lines 677-680) never run.
- **`prisma/reset-hard.ts`'s `flushRedis`** (lines 83-119): its
  `sock.on("end", () => { clearTimeout(timer); resolve(); })` handler calls
  `resolve()` unconditionally, with no check of whether a `+OK` reply was
  ever observed. A peer that closes the connection after receiving
  `FLUSHALL` but before replying is treated as a successful flush — the
  script prints `"[reset-hard] Redis FLUSHALL: OK"` even though no
  confirmation was received, defeating the known-zero-state guarantee the
  reset promises.

The two implementations also diverge unnecessarily: `wipe-manual-uat.ts`
flushes `FLUSHDB` (current DB only) while `reset-hard.ts` flushes `FLUSHALL`
(every DB) — that divergence is intentional per each script's blast radius
(manual-UAT touches one DB; reset-hard is a full local/dev reset) and is
**not** part of this change's scope; only the close/end-handler resolve
semantics are fixed.

## What Changes

- `wipe-manual-uat.ts`'s `flushRedisDb`: the `close` handler resolves
  idempotently instead of leaving the promise unsettled —
  `resolve({ flushed: false, reason: "closed-before-reply" })` — guarded so
  it only fires if no other resolution path (the `data`/`+OK` success case or
  the `error` case) has already resolved the promise.
- `reset-hard.ts`'s `flushRedis`: track whether a `+OK` reply was actually
  observed (a boolean set only inside the `data` handler's `+OK` branch); the
  `end` handler rejects with an explicit error
  (`Redis FLUSHALL: connection closed before +OK was received`) instead of
  unconditionally resolving, mirroring `wipe-manual-uat.ts`'s honest
  parse-and-report pattern.
- No change to the `FLUSHDB` vs `FLUSHALL` command choice, the 5-second
  timeout, or either script's Postgres-side logic.

## Claim disposition table

| Sub-claim                                                                                                   | Review evidence                                                                     | Disposition                                       |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------- |
| `wipe-manual-uat.ts`'s `close` handler never resolves, permanently hanging the promise on a replyless close | `wipe-manual-uat.ts:106-148`, `socket.once("close", ...)` only clears the timer     | CONFIRMED — fix                                   |
| `reset-hard.ts`'s `end` handler resolves unconditionally, reporting false "OK" without observing `+OK`      | `reset-hard.ts:83-119`, `sock.on("end", () => { clearTimeout(timer); resolve(); })` | CONFIRMED — fix                                   |
| Both scripts use hand-rolled RESP over raw TCP sockets, not an ioredis client                               | direct read of both files, `net.createConnection` + `writeRedisCommand` helper      | CONFIRMED (context, not itself a defect in scope) |

## Non-goals

- Not unifying `FLUSHDB` vs `FLUSHALL` across the two scripts — the
  difference matches each script's intended blast radius.
- Not replacing the hand-rolled RESP socket code with an ioredis client —
  out of scope; the review's recommendation targets only the resolve/reject
  semantics of the existing handlers, not a rewrite.
- Not touching the Postgres-side FK-safe delete ordering
  (`manual-uat-reseed` spec, already covered) or `destructive-db-guard`'s
  environment/host safety checks — this change is Redis-flush-only.
- Not adding retry logic on a failed/ambiguous flush — a rejected promise
  (or an honestly-reported `flushed: false`) is sufficient; the caller
  already treats a Redis-flush failure as non-fatal to the overall reset per
  each script's existing control flow (confirm exact caller behavior is
  preserved during implementation).

## File manifest

- `prisma/wipe-manual-uat.ts` — `flushRedisDb` (lines 106-148), call site at
  line 665, `finally` cleanup at lines 677-680
- `prisma/reset-hard.ts` — `flushRedis` (lines 83-119), call site at line
  170
- Tests: none exist today for either script (confirmed —
  `find prisma -iname "*.test.ts" -o -iname "*.spec.ts"` returns no
  results). This change adds the first test coverage for both flush
  functions:
  - `prisma/wipe-manual-uat.flush-redis.test.ts` (new) — unit test against a
    mock TCP server simulating: (1) a normal `+OK` reply, (2) a close with
    no reply, (3) an error
  - `prisma/reset-hard.flush-redis.test.ts` (new) — same three cases against
    `reset-hard.ts`'s `flushRedis`

## Verification

- `pnpm --filter @customreport/api db:generate && pnpm typecheck && pnpm lint && pnpm test`
- `cd apps/api && pnpm test:integration` — not directly applicable (these are
  root `prisma/` maintenance scripts, not `apps/api` code), but run to
  confirm no regression in any integration-test bootstrap that shells out to
  these scripts.
- **Operational smoke task** (required for this change per the P1
  verification bar — proves the fix live, not just against a mock socket):
  1. Run `pnpm --filter @customreport/api db:reset:hard` (or the exact
     script entrypoint for `reset-hard.ts`) against a local dev Postgres +
     Redis, then immediately run `redis-cli -h <host> -p <port> DBSIZE`
     against every Redis DB index the script targets and confirm `0` — this
     proves the flush actually completed, not merely that the script printed
     "OK".
  2. Run the manual-UAT wipe entrypoint (`pnpm db:fresh:manual-uat` or
     equivalent) against a UAT-shaped local DB with Redis populated with a
     test key beforehand (`redis-cli SET smoke-test-key 1`), confirm the
     script does not hang past its normal completion time, and confirm
     `redis-cli GET smoke-test-key` returns nil afterward.
  3. Simulate the close-before-reply race by killing the local Redis
     process mid-flush (e.g. `redis-cli SHUTDOWN NOSAVE` timed to fire after
     the script sends `FLUSHDB`/`FLUSHALL` but before it can reply) and
     confirm: `wipe-manual-uat.ts` reports `{ flushed: false, reason: "closed-before-reply" }`
     and does not hang; `reset-hard.ts` rejects with the new explicit error
     instead of printing a false "OK".
     Capture the three outcomes in the PR description as live-verify evidence.

## Sequencing

No dependency on the other four changes in this batch — `prisma/*.ts`
scripts are not touched by any of them. Can land independently.
