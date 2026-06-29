## 1. Shared Schema — search-q safeText guard

- [ ] 1.1 In `packages/shared/src/schemas/search.ts`, replace the
      `z.string().min(2).max(200)` on the `q` field with
      `safeText({ min: 2, max: 200 })` — preserve the min-2 floor; the only
      behavioral change is the added null-byte and invisible-only refinements.
- [ ] 1.2 Add unit tests in `packages/shared` asserting that (a) a `q` value
      containing a null byte fails Zod validation with a `BAD_REQUEST`-class
      error, and (b) a single-character `q` (e.g. `'a'`) is rejected by the
      min-2 floor.

## 2. Shared Schema — sparkline bound correction (behavioral)

- [ ] 2.1 Grep for sparkline producers in `apps/api` to confirm no producer
      emits more than 4 data points.
- [ ] 2.2 In `packages/shared/src/schemas/telemetry.ts`, change sparkline array
      bound from `.max(8)` to `.max(4)` to match the documented and produced cap.
      Update the inline comment accordingly.

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

## 9. Verification

- [ ] 9.1 Run `pnpm typecheck` — must exit 0 with no new errors.
- [ ] 9.2 Run `pnpm lint` — must exit 0.
- [ ] 9.3 Run `pnpm test` — must exit 0; new unit tests for search-q,
      correlation-id middleware, and JWT alg pin must be green.
- [ ] 9.4 Run `pnpm build` — must exit 0.
- [ ] 9.5 Run `openspec validate "input-and-error-hardening" --strict` — must exit 0.
