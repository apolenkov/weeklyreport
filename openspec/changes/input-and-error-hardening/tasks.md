## 1. Shared Schema — search-q safeText guard

- [ ] 1.1 In `packages/shared/src/schemas/search.ts`, replace the
      `z.string().min(2).max(200)` on the `q` field with
      `safeText({ min: 2, max: 200 })` — preserve the min-2 floor; the only
      behavioral change is the added null-byte and invisible-only refinements.
- [ ] 1.2 Add unit tests in `packages/shared` asserting Zod-level rejection:
      (a) a `q` value containing a null byte fails `safeParse` (`success` is
      `false`), and (b) a single-character `q` (e.g. `'a'`) is rejected by the
      min-2 floor. Shared-schema tests can only observe the Zod parse failure,
      not the tRPC error class.
- [ ] 1.3 Add an API/tRPC input test (in `apps/api`) asserting that calling
      `search.query` with a null-byte `q` fails with a `BAD_REQUEST` tRPC error
      before the repository is invoked. The `BAD_REQUEST` mapping is the tRPC
      router boundary's translation of the Zod failure, so it must be exercised
      at that layer, not in `packages/shared`.

## 2. Shared Schema — sparkline bound correction (behavioral)

- [ ] 2.1 Grep for sparkline producers in `apps/api` to confirm no producer
      emits more than 4 data points.
- [ ] 2.2 In `packages/shared/src/schemas/telemetry.ts`, change sparkline array
      bound from `.max(8)` to `.max(4)` to match the documented and produced cap.
      Update the inline comment accordingly. This satisfies the
      `telemetry-summary-contract` ADDED requirement (sparkline length ≤ 4).
- [ ] 2.3 Update the existing `packages/shared/src/schemas/telemetry.test.ts`
      "caps sparkline length at 8 entries" test to assert the 4-point cap: a
      5-entry array MUST now fail and a 4-entry array MUST pass. Rename the test
      and trace it to the `telemetry-summary-contract` requirement.

## 3. API Middleware — x-request-id cap

- [ ] 3.1 In `apps/api/src/infrastructure/middleware/correlation-id.middleware.ts`,
      validate the inbound `x-request-id` header against `/^[\x20-\x7E]{1,128}$/`
      before adopting it as the CLS `correlationId`. Fall back to a fresh `randomUUID()`
      when the header is absent or fails validation.
- [ ] 3.2 Add unit tests for the middleware: valid header adopted, oversized header
      replaced with UUID, header with control character replaced with UUID, absent
      header generates UUID.

## 4. API Auth — JWT algorithm pin

- [ ] 4.1 In `apps/api/src/modules/auth/auth.controller.ts`, add
      `{ algorithms: ['HS256'] }` as the third argument to every `jwt.verify` call.
- [ ] 4.2 Add or update a unit test asserting that a token with `alg: 'none'`
      or an asymmetric algorithm header is rejected by `verifySessionToken`.

## 5. tRPC Router — dev.wipeAndReseed role restriction

- [ ] 5.1 In `apps/api/src/infrastructure/trpc/trpc.router.ts`, change the
      `dev.wipeAndReseed` procedure from `protectedProcedure` to `adminProcedure`.
- [ ] 5.2 Verify no test helper calls `dev.wipeAndReseed` with a non-admin
      session; update any such helper to use an admin token.
- [ ] 5.3 In `apps/web/src/components/dev/role-switcher.tsx`, hide (or disable)
      the four "Wipe + Reseed" / "Wipe reports" data-reset controls unless the
      current dev session's role is `admin`. The controls render for every dev
      role today; with `adminProcedure` they would fail with a `FORBIDDEN` alert
      for lead/head/viewer sessions. Keep the lookup minimal (read the current
      session role) — do not over-engineer the mechanism.
- [ ] 5.4 Add a web unit test asserting the reset controls are present for an
      `admin` dev session and absent (or disabled) for a non-admin dev session.

## 6. Prisma Seeds — assertNonProdDestructive guard

- [ ] 6.1 In `prisma/seed.ts`, add `assertNonProdDestructive('seed')` as the
      first statement inside `main()`, imported from `prisma/_destructive-guard.ts`.
- [ ] 6.2 In `prisma/backfill-policy-rules.ts`, add
      `assertNonProdDestructive('backfill-policy-rules')` as the first statement
      inside `main()`.

## 7. Audit Types — AuditEvent union

- [ ] 7.1 In `apps/api/src/lib/audit-logger-types.ts`, add `'period.manual-edit'`
      to the `AuditEvent` string-literal union.
- [ ] 7.2 In `apps/api/src/lib/audit-logger.ts`, introduce a typed local `emit`
      helper inside `createAuditLogger` whose payload parameter is typed
      `{ event: AuditEvent } & Record<string, unknown>`, and route EVERY emit
      object literal (all ~15 sites) through it (replacing the direct
      `logger.info/warn(AUDIT_MESSAGE, { event: '…', … })` calls). This makes an
      undeclared or misspelled `event` string a `pnpm typecheck` error at the
      call site, satisfying the enum-state-hygiene compile-error scenario.
      A bare `satisfies AuditEnvelope` does not work — it rejects the per-event
      fields as excess properties.

## 8. Comment Corrections

- [ ] 8.1 In `packages/shared/src/schemas/report-primitives.schema.ts`, update
      the `stageIds` storage comment: the field is a native `String[]` array;
      comma-joining is display-only and not the storage format.
- [ ] 8.2 In `packages/shared/src/schemas/auth.ts`, correct the comment on
      `sessionRoleSchema` that claims it is wider than `roleSchema`; the two enums
      are now identical.
- [ ] 8.3 In `prisma/seed-simple.ts`, update the comment that asserts a
      name-match ownership invariant; the app replaced that with id-based ownership
      and the comment is now misleading.

## 9. tRPC Context — resolve session cookie name from AUTH_JWT_COOKIE_NAME

- [ ] 9.1 In `apps/api/src/infrastructure/trpc/trpc.context.ts`, replace the
      hardcoded `req.cookies?.customreport_session` read (line ~190) with a
      name resolved from `env.AUTH_JWT_COOKIE_NAME ?? "customreport_session"`,
      matching the existing pattern in `auth.controller.ts`, `auth.routes.ts`,
      `jwt.strategy.ts`, and `pdf-export.service.ts`. Reuse the same `env`
      accessor those auth sites use; keep `"customreport_session"` as the
      single fallback literal.
- [ ] 9.2 Add a unit test asserting the context reads the token from the cookie
      named by `AUTH_JWT_COOKIE_NAME`: (a) knob unset → a `customreport_session`
      cookie is used; (b) `AUTH_JWT_COOKIE_NAME` set to a non-default value →
      the cookie under that name is used and a `customreport_session` cookie is
      not required.

## 10. Destructive Guard — correct misleading docstring

- [ ] 10.1 In `prisma/_destructive-guard.ts`, fix the header docstring so the
      "Allow rules" list no longer presents `postgres (docker)` as a host that
      is impossible to reach prod through / unconditionally allowed. State that
      only `localhost`/`127.0.0.1`/`*.local` are truly local and that the
      `postgres` Docker host requires an explicit non-prod suffix, matching the
      `isTrulyLocal` check. Docstring-only change; do not alter the runtime
      logic, which is already correct.

## 11. Verification

- [ ] 11.1 Run `pnpm typecheck` — must exit 0 with no new errors.
- [ ] 11.2 Run `pnpm lint` — must exit 0.
- [ ] 11.3 Run `pnpm test` — must exit 0; new/updated unit tests must be green:
      search-q (shared Zod + tRPC BAD_REQUEST), correlation-id middleware, JWT
      alg pin, sparkline 4-point cap, the DevRoleSwitcher admin-only reset
      controls, and the tRPC-context cookie-name resolution.
- [ ] 11.4 Run `pnpm build` — must exit 0.
- [ ] 11.5 Run `openspec validate "input-and-error-hardening" --strict` — must exit 0.
