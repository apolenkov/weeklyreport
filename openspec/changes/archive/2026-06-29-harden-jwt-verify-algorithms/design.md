# Design — harden-jwt-verify-algorithms

## Context

The session token is an HS256 JWT signed and verified with a shared
`AUTH_JWT_SECRET`. `verifySessionToken` (built on `jwt.verify`) is the live
request-auth path used by `trpc.context.ts` and `bull-board.module.ts`; a second
unpinned `jwt.verify` lives in `pdf-export.service.ts`.

## Key decisions

### D1 — pin `algorithms: ["HS256"]` on verify

`jwt.verify(token, secret)` without an `algorithms` allow-list lets the library
accept any algorithm the key can satisfy. For a symmetric secret the practical
exposure is limited (`jsonwebtoken@9` rejects `none`; no public key is present
for an RS256→HS256 swap), so this is defence-in-depth and explicitly best
practice. Pin it at both verify sites. Sign already pins `HS256`, so valid
tokens are unaffected.

### D2 — minimum secret length at one site

`requireJwtSecret` becomes the single gate that also rejects a secret shorter
than 32 characters, with a boot-time error naming the variable and the floor.
This is the substantive control: a weak symmetric secret is offline-brute-
forceable from any captured token. 32 chars is the conventional floor for an
HS256 secret; it is enforced once and reused by the controller.

- Trade-off: a too-short secret now fails boot. That is intended — it converts a
  silent weakness into a loud, fix-before-start error. Dev/test `.env` examples
  already use long secrets; verify they clear the floor.

### D3 — keep it independent of the layering refactor

These edits touch only the verify call and the secret check. They do not depend
on `refactor-auth-exemplary-layering` and can land first, mirroring the repo's
preference for small, independently-shippable changes.

## Risks

- A real deployment with a short secret will fail boot after this lands — that is
  the point, but it must be called out in the change so ops rotates to a
  conforming secret first.

## Out of scope

- Asymmetric signing / key rotation tooling.
- Any auth module restructuring (separate change).
