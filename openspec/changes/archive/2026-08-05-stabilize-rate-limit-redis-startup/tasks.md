## 1. Startup readiness

- [x] 1.1 Make rate-limit construction asynchronous and await readiness for an internally owned Redis client before building ingress stores.
- [x] 1.2 Await rate-limit construction through the HTTP pipeline and API bootstrap without changing ingress order.
- [x] 1.3 Update all unit/integration callers and add regression coverage for the owned-client readiness contract.

## 2. Verification

- [x] 2.1 Run focused rate-limit unit and Redis integration tests, API TypeScript, and strict ESLint.
- [x] 2.2 Restart the source API against minimal Postgres/Redis; prove readiness, zero false startup errors, and a shared `rl:*` counter.
- [x] 2.3 Run an exact-change review, resolve blockers, sync the new spec, and archive the change before final runtime evidence.
