# Pin the JWT verify algorithm and require a strong session secret

## Why

The session JWT is verified without pinning the accepted algorithm, and the
signing secret is accepted with no minimum strength.

- `auth.controller.ts::verifySession` calls `jwt.verify(token, secret)` with no
  `algorithms` option. The same unpinned call exists in
  `pdf-export.service.ts`. `verifySessionToken` is the live request-auth path
  (`trpc.context.ts`, `bull-board.module.ts`), so this is the real verifier, not
  a vestige.
- `requireJwtSecret` / `requireSecret` check only that `AUTH_JWT_SECRET` is
  present, never its length. An HS256 secret short enough to brute-force offline
  from any captured token is the risk that actually matters for a symmetric token.

For a symmetric HS256 secret the classic RS256→HS256 confusion does not apply
(no public key is in play, and `jsonwebtoken@9` rejects `none`), so pinning the
algorithm is defence-in-depth; the secret-strength floor is the substantive fix.
Both are cheap and belong together.

## What Changes

- Pass `{ algorithms: ["HS256"] }` to every `jwt.verify` of a session token:
  `apps/api/src/modules/auth/auth.controller.ts` and
  `apps/api/src/modules/pdf-export/pdf-export.service.ts`.
- Enforce a minimum `AUTH_JWT_SECRET` length (≥ 32 characters) at the single
  require-secret site; fail boot with a clear message when it is too short.
- Add unit tests: a token signed with a non-HS256 algorithm is rejected on
  verify; a too-short secret fails the require-secret check.

## Capabilities

### New Capabilities

- `jwt-session-integrity`: session-token verification pins the signing algorithm
  and the signing secret meets a minimum strength.

## Impact

- **Affected code:** `auth.controller.ts` (verify + require-secret),
  `pdf-export.service.ts` (verify). No schema, API, or shared-contract change.
- **Behaviour:** valid HS256 sessions are unaffected; a deployment whose
  `AUTH_JWT_SECRET` is shorter than the floor now fails fast at boot instead of
  running with a weak secret.
- **Ordering vs `refactor-auth-exemplary-layering`:** both changes touch
  `auth.controller.ts`. This change can ship first (it needs nothing from the
  refactor). But the refactor dedups the require-env helpers, so it MUST keep
  `requireJwtSecret` (with the `>= 32` length check added here) a distinct function
  rather than collapsing it into a generic `requireEnv`, and MUST preserve the
  `jwt.verify` `{ algorithms: ["HS256"] }` pin. Whichever lands second carries that
  obligation.
- **Out of scope:** rotating to an asymmetric algorithm; any secret-management /
  rotation tooling; the auth layering refactor.
