## Context

The API (`apps/api`) runs as an Express application bootstrapped in
`main.ts`. In production the Caddy edge proxy terminates TLS and forwards
requests, setting `X-Forwarded-For` to the real client IP. Express only
reads `X-Forwarded-For` when `trust proxy` is configured; without it,
`req.ip` resolves to the socket remote address — the Caddy container.

Current state (broken):

- `expressApp` is obtained at line 344 of `main.ts`.
- `trust proxy` is never set anywhere.
- `rate-limit.middleware.ts` line 33 contains the comment
  `// Express's \`app.set('trust proxy', 1)\` upstream makes this safe.`
  This claim is false and misdirects future readers.
- The tRPC context (`trpc.context.ts`) reads `req.ip ?? 'unknown'` for
  audit. Currently that always resolves to the proxy address.

Data flow affected:

```
Client → Caddy (sets X-Forwarded-For) → API expressApp → req.ip
   without trust proxy:  req.ip = 172.18.0.2  (Caddy container)
   with    trust proxy:  req.ip = <real client IP>
```

## Goals / Non-Goals

**Goals:**

- `req.ip` resolves to the real client IP on every request handled by the
  Express instance (rate-limit, audit, HTTP access log, client-log endpoint).
- The misleading comment is removed so future readers cannot be misled.
- A Vitest unit test proves the IP resolution behaviour under trust proxy.

**Non-Goals:**

- Configuring trust proxy to accept more than one hop (Caddy is the only
  edge; `1` is the correct value).
- Adding CIDR-based trust configuration via env (overkill for a single-hop
  setup; add only if the deployment topology changes).
- Changing the audit schema or any Prisma model (no data migration needed).
- Modifying tRPC context code (`req.ip` read is already correct once the
  setting is in place).

## Decisions

**Decision 1: Use numeric `1` rather than a CIDR string.**

Alternatives considered:

- `true` — trusts all proxies; unsafe if traffic can arrive from untrusted
  addresses on the same network.
- A CIDR string for the Caddy container subnet — correct but over-engineered;
  the Docker Compose internal network is not customer-configurable.
- `1` — trusts exactly one proxy hop, which matches the Caddy topology.

Chosen: `1`. It is the canonical Express recommendation for a single
reverse-proxy hop and matches the express-rate-limit documentation.

**Decision 2: Set trust proxy on `expressApp`, not on the NestJS `app`.**

`app.set()` on the NestJS `ApplicationBuilder` does propagate to the
underlying Express instance. However, the tRPC adapter and PDF static
serving are mounted directly on `expressApp`, retrieved with
`app.getHttpAdapter().getInstance()`. Setting trust proxy on `expressApp`
at line 344 (immediately after the line that retrieves it) is the most
explicit and least surprising placement — it is adjacent to all the
`expressApp.use(...)` calls and cannot be missed by a future reader.

**Decision 3: Place the call immediately after `expressApp` is obtained,
before all `expressApp.use(...)` registrations.**

This guarantees the setting is active for:

- the `/pdfs` static serve
- the `trpcLimiter` (rate-limit middleware)
- the tRPC adapter (which creates the audit context)
- the auth routes
- the Bull Board mount

Order matters: Express evaluates `trust proxy` at request time, not at
middleware registration time, so any ordering before the first request
would technically work. The explicit early placement prevents ordering
regressions.

**Decision 4: Unit test via a minimal Express app, not integration test.**

The behaviour being tested (IP resolution from `X-Forwarded-For`) is an
Express internals concern that does not require a running NestJS app or a
database. A Vitest unit test that spins up a minimal `express()` instance
with `trust proxy: 1` and calls `createRateLimits` keeps the test fast,
dependency-free, and provably correct.

## Risks / Trade-offs

- **Local dev no-op** — `X-Forwarded-For` is not set in local development
  (no Caddy in `docker-compose.yml`). `req.ip` will still resolve to
  `127.0.0.1` (loopback). This is correct and expected behaviour; the
  change has no effect on local runs.
- **Rate-limit bucket split in prod** — enabling trust proxy changes the
  per-client key from the Caddy IP to the real client IP. Any in-flight
  rate-limit counter keyed to the old Caddy IP will be discarded on
  restart. This is the desired behaviour — old counters were meaningless
  anyway. No rollback concern.
- **Audit IP forensics gap** — historical audit rows in production already
  contain the wrong (proxy) IP. Those rows are not correctable in an MVP
  database. Future audit rows will be correct immediately after deploy.
  Acceptable: document the gap in a code comment next to the new call.
- **No env flag needed** — the trust-proxy value `1` is correct for both
  production and staging (both sit behind Caddy). No feature flag required.

## Migration Plan

1. Add `expressApp.set('trust proxy', 1)` at the top of the `expressApp`
   usage block in `main.ts`.
2. Delete lines 32–33 (the false comment) in `rate-limit.middleware.ts`.
3. Add Vitest test file
   `apps/api/src/infrastructure/throttler/rate-limit.middleware.test.ts`.
4. Run `pnpm typecheck && pnpm lint && pnpm test` — all gates must pass.
5. Deploy: rolling restart is sufficient; no migration, no flag flip.

Rollback: revert the `main.ts` line. Rate-limiting will revert to the
broken Caddy-IP bucket. No data is at risk.

## Open Questions

_(none — scope is fully bounded)_
