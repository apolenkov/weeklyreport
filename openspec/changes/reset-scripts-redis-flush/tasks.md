## 1. `wipe-manual-uat.ts` — resolve idempotently on a replyless close

- [ ] 1.1 `prisma/wipe-manual-uat.ts`: in `flushRedisDb`, track whether the
      promise has already settled (a local `settled` flag, or restructure to
      resolve exactly once); in the `socket.once("close", ...)` handler,
      call `resolve({ flushed: false, reason: "closed-before-reply" })` if
      no other path has settled yet
- [ ] 1.2 Confirm the `data`/`+OK` success path and the `error` path both
      still resolve/settle exactly once, with the `close` handler's fallback
      never double-resolving after either

## 2. `reset-hard.ts` — track observed `+OK`, don't resolve blind

- [ ] 2.1 `prisma/reset-hard.ts`: in `flushRedis`, add a boolean (e.g.
      `receivedOk`) set to `true` only inside the `data` handler's
      `buf.startsWith("+OK")` branch
- [ ] 2.2 Change the `sock.on("end", ...)` handler: if `receivedOk` is
      `true`, resolve as today; otherwise reject with
      `new Error("Redis FLUSHALL: connection closed before +OK was received")`
- [ ] 2.3 Confirm the existing `-ERR` rejection path and the `error`/timeout
      paths are unaffected

## 3. Tests

- [ ] 3.1 Add `prisma/wipe-manual-uat.flush-redis.test.ts` (new): mock TCP
      server returning (a) `+OK\r\n`, (b) a bare close with no data, (c) a
      socket error; assert `flushRedisDb` resolves `{flushed:true}`,
      resolves `{flushed:false, reason:"closed-before-reply"}`, and resolves
      `{flushed:false, reason:<error message>}` respectively — and that case
      (b) resolves promptly, not after the 5s timeout
- [ ] 3.2 Add `prisma/reset-hard.flush-redis.test.ts` (new): same three
      cases against `flushRedis`; assert case (a) resolves, case (b) rejects
      with the new explicit error, case (c) rejects with the socket error

## 4. Spec delta

- [ ] 4.1 `reset-script-redis-flush` (new capability): ADD a requirement
      that both reset scripts' Redis flush settles honestly — success only
      on an observed `+OK`, and a replyless close is never reported as
      success nor left hanging

## 5. Gates and verification

- [ ] 5.1 `pnpm --filter @customreport/api db:generate`
- [ ] 5.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 5.3 `cd apps/api && pnpm test:integration`
- [ ] 5.4 Operational smoke: run `reset-hard` and manual-UAT wipe against a
      local dev DB + Redis, confirm `redis-cli DBSIZE` is `0` after each and
      neither script hangs; simulate a mid-flush Redis kill and confirm
      honest failure reporting on both scripts (see proposal.md Verification
      section for the exact procedure); capture outcomes as live-verify
      evidence
- [ ] 5.5 `openspec validate reset-scripts-redis-flush --strict`
