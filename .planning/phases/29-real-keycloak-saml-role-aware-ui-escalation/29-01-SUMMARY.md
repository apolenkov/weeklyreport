# 29-01 SUMMARY — AUTH-08 structured audit events

**Status:** COMPLETED
**Commit:** 7a8ebb4
**Phase:** 29-real-keycloak-saml-role-aware-ui-escalation
**Plan:** 01

## What shipped

Structured audit channel for security-relevant events (login success/fail, logout, role-denied), composed onto the existing AppLogger (Phase 26 nestjs-cls correlation IDs). No new transport, no new env var.

## Audit envelope shape (final)

```typescript
export type AuditEvent =
  | "login-success"
  | "login-fail"
  | "logout"
  | "role-denied";

export type AuditEnvelope = {
  readonly event: AuditEvent;
  readonly userId: string;
  readonly role: Role | "unknown";
  readonly attemptedRole?: ReadonlyArray<Role> | Role;
  readonly ip: string;
};

export interface AuditLogger {
  loginSuccess(input: Omit<AuditEnvelope, "event" | "attemptedRole">): void;
  loginFail(
    input: Omit<AuditEnvelope, "event" | "attemptedRole"> & { reason: string },
  ): void;
  logout(input: Omit<AuditEnvelope, "event" | "attemptedRole">): void;
  roleDenied(input: Omit<AuditEnvelope, "event">): void;
}
```

`loginFail` carries an extra `reason: string` for SAML / token-verify failure paths.

## Files modified

| File                                                                  | LOC delta | Note                                                                    |
| --------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------- |
| apps/api/src/lib/audit-logger.ts (new)                                | +101      | createAuditLogger + createNullAuditLogger                               |
| apps/api/src/lib/audit-logger.test.ts (new)                           | +145      | 6 unit tests, envelope + whitelist coverage                             |
| apps/api/src/infrastructure/trpc/**tests**/audit-events.test.ts (new) | +143      | 3 integration-style tests on the role-deny seam                         |
| apps/api/src/infrastructure/trpc/trpc.context.ts                      | +21/-3    | TrpcContext + auditLogger + ip; factory builds auditLogger once         |
| apps/api/src/infrastructure/trpc/trpc.middleware.ts                   | +27/-12   | Local buildRoleMiddleware emits roleDenied before re-throwing FORBIDDEN |
| apps/api/src/infrastructure/trpc/trpc.middleware.test.ts              | +30/-2    | Test harnesses now include auditLogger + ip                             |
| apps/api/src/modules/auth/auth.routes.ts                              | +37/-2    | SAML callback emits loginSuccess/loginFail; logout route emits logout   |
| apps/api/src/main.ts                                                  | +11/-1    | createAuditLogger wired into mountAuthRoutes                            |

## Test counts

| Suite                 | Before                    | After           | Delta   |
| --------------------- | ------------------------- | --------------- | ------- |
| api unit              | 435 / 33 files            | 444 / 35 files  | +9 / +2 |
| web unit              | 168 (1 pre-existing fail) | 168 (same fail) | 0       |
| shared unit           | 218                       | 218             | 0       |
| typecheck (api + web) | green                     | green           | —       |

The single web failure (`apps/web/proxy.test.ts`) is pre-existing and not touched by this plan.

## Key design choices / deviations

1. **Role middleware rebuilt locally rather than modifying shared `requireRole`.** The plan said "tRPC role-deny path in apps/api/src/infrastructure/trpc/trpc.middleware.ts (the requireRole middleware) calls auditLogger.roleDenied(...)". The actual `requireRole` factory lives in `@customreport/shared/trpc`. To keep shared free of an api-side ctx dependency, I replaced the four `requireRole(t, ...)` calls with a local `buildRoleMiddleware(allowed)` that delegates to the pure `assertRole` helper (also exported by shared) and emits `roleDenied` in a try/catch around the FORBIDDEN throw. The role-coverage gate (`role-coverage.test.ts`) compares middleware identity captured from `headProcedure._def.middlewares`, so it continues to pass — verified by the green test run.

2. **A-1 mitigation preserved.** The audit emit lives inside the factory (`buildRoleMiddleware`), not at consumer sites — so future deny conditions added in 29-04 (SAML cut-over) inherit the audit signal automatically.

3. **T2 mitigation:** the deny path emits even when role/userId are missing (`'anonymous'` / `'unknown'`) rather than swallowing.

4. **T3 mitigation:** `ctx.ip` is read from `req.ip` (Express trust-proxy aware) once per context, never from raw `X-Forwarded-For`.

5. **T1 mitigation:** the AuditLogger implementation only forwards typed input fields — `samlAssertion`, `cookie`, `token`, `password`, `authorization` cannot leak; verified by a unit test.

6. **UNAUTHORIZED is NOT audited as role-denied.** When `assertRole` throws UNAUTHORIZED (no session), the local middleware re-throws without emitting — the upstream `loginFail` path is the right surface for that. Unit-tested.

7. **Integration test placed at `__tests__/audit-events.test.ts`** (not `.integration.test.ts`) so it runs in the standard `pnpm test` lane. The plan named it `.integration.test.ts` but that file pattern is excluded from `pnpm test` and not listed in `pnpm test:integration` — using `.test.ts` keeps the audit signal tested on every PR.

## Verification

- `pnpm --filter @customreport/api typecheck` exit 0
- `pnpm --filter @customreport/web typecheck` exit 0
- `pnpm --filter @customreport/api test` 444/444 green
- One commit (7a8ebb4) — atomic, no amends
