## 1. Shared helper (api/auth)

- [ ] 1.1 Add `isUserAccessBarred(userId, prisma, sessionRevocation)` (boolean) in a new file under `apps/api/src/modules/auth/` (e.g. `session-deactivation.ts`), implementing Redis fast-path (fail-open) then Prisma `User.isActive` (fail-closed). The Prisma tier MUST bar a null/missing row too — `findUnique` returning `null` reports barred (`!userRow || !userRow.isActive`), not just `isActive === false` — per design D1/D2/D4.
- [ ] 1.2 Add a unit test covering: deactivated → barred, active+not-revoked → permitted, revoked-set hit → barred, Redis-throws → falls through to Prisma (not barred when active), and **missing user row (`findUnique` → null) → barred** (D4).

## 2. Wire the three call sites (api)

- [ ] 2.1 Refactor the regular session path in `trpc.context.ts` (lines ~201-212) to call the helper. The revoked/deactivated outcomes stay unchanged; the helper now also rejects a null user row, replacing the fail-open `if (userRow && !userRow.isActive)` with the helper's `!userRow || !userRow.isActive` decision (D4) so a hard-deleted user no longer keeps a live session.
- [ ] 2.2 In `buildPdfExportSession` (`trpc.context.ts`), call the helper on `requestedBy` before hydrating; return `null` when barred. Leave the legacy no-`requestedBy` path untouched.
- [ ] 2.3 In `mountBullBoard` (`bull-board.module.ts`), resolve both `PrismaService` and the existing `SessionRevocationService` from Nest DI via `_app.get(...)` (the service is provided+exported by `AdminModule`, so its `onModuleDestroy` cleanup still fires — do NOT `new` a fresh instance); make `requireHead` async and call the helper after the role check, denying 401 when barred.

## 3. Tests (api)

- [ ] 3.1 Test `buildPdfExportSession`: deactivated requester → `null`; active requester → scoped session as before.
- [ ] 3.2 Test the Bull Board guard: deactivated head → 401 and `next()` not called; active head → reaches the router; revoked-set head → 401 via fast-path.
- [ ] 3.3 Test the regular path regression: deactivated session token still does not yield a regular authenticated session.
- [ ] 3.4 Test the regular path null-user case (D4): a valid session JWT whose user row was hard-deleted (and is absent from the revoked set) does NOT yield a regular authenticated session.

## 4. Verification

- [ ] 4.1 Run `pnpm typecheck && pnpm lint && pnpm test` and confirm green.
- [ ] 4.2 Run `openspec validate "enforce-deactivation-pdf-bullboard" --strict` and confirm it exits 0.
