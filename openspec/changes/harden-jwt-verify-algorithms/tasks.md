# Tasks — harden-jwt-verify-algorithms

## 1. Pin the verify algorithm

- [ ] 1.1 In `apps/api/src/modules/auth/auth.controller.ts`, pass
      `{ algorithms: ["HS256"] }` to `jwt.verify` in `verifySession`.
- [ ] 1.2 In `apps/api/src/modules/pdf-export/pdf-export.service.ts`, pass the same
      `{ algorithms: ["HS256"] }` to its `jwt.verify`.
- [ ] 1.3 Add a unit test: a token signed with a non-HS256 algorithm is rejected by
      `verifySessionToken`; a valid HS256 token still verifies.

## 2. Enforce minimum secret strength

- [ ] 2.1 In `requireJwtSecret` (`auth.controller.ts`), reject a secret shorter than
      32 characters with a boot-time error naming `AUTH_JWT_SECRET` and the minimum.
- [ ] 2.2 Add a unit test: a too-short secret throws; a ≥32-char secret is accepted.
- [ ] 2.3 Verify `.env.example` / `.env.test.example` secrets clear the 32-char floor;
      bump them if not.

## 3. Gates

- [ ] 3.1 `pnpm typecheck && pnpm lint && pnpm test` all green.
- [ ] 3.2 `openspec validate harden-jwt-verify-algorithms --strict`.
