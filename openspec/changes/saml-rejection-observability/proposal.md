## Why

BL-15 (P1) from `docs/reviews/repo-excellence-review-2026-07-14.md`: rejected
SAML assertions produce no audit entry or fail metric.

`mountAuthRoutes` (`apps/api/src/modules/auth/auth.routes.ts:202-211`) mounts
the callback with:

```ts
passport.authenticate("saml", {
  session: false,
  failureRedirect: `${frontendUrl}/auth/error?reason=invalid_assertion`,
}) as RequestHandler,
createSamlCallbackHandler(deps),
```

`passport.authenticate`'s `failureRedirect` option intercepts an
assertion-validation failure (bad signature, expired, replay) internally: it
performs its own `res.redirect` and terminates the middleware chain _before_
Express reaches `createSamlCallbackHandler`. That handler's `!profile` branch
(`auth.routes.ts:45-58`) — `auditLogger.loginFail({..., reason: "invalid_assertion"})`
and `loginAttemptsTotal.inc({method:"saml", outcome:"fail"})` — is therefore
dead code for the actual, most-common failure path. It would only run if
Passport called `next()` with no `req.user`, which does not happen under
`failureRedirect`. Every genuinely rejected SAML assertion today is invisible
to both the audit trail and the Prometheus counter — only a post-passport
DB/JWT exception downstream of a _successful_ assertion gets recorded.

## What Changes

- `mountAuthRoutes` drops `failureRedirect` from the `passport.authenticate("saml", ...)`
  options and instead passes a custom verify-style callback (the
  `(err, user, info) => {...}` form `passport.authenticate` accepts when no
  redirect option is given) that runs on both success and failure.
- On `err` or a missing `user`, the callback emits the existing
  `auditLogger.loginFail({..., reason: "invalid_assertion"})` and
  `loginAttemptsTotal.inc({method:"saml", outcome:"fail"})` calls (reusing
  `createSamlCallbackHandler`'s existing `!profile` branch logic, now made
  reachable) and then redirects to `/auth/error?reason=invalid_assertion` —
  the same destination `failureRedirect` used, so client-visible behavior on
  a rejected assertion is unchanged.
- On success, the callback proceeds into the existing session-issuance logic
  unchanged.

## Claim disposition table

| Sub-claim                                                                                                             | Review evidence                                                                                                                                                                                 | Disposition     |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `failureRedirect` intercepts SAML assertion failures before `createSamlCallbackHandler` runs                          | `auth.routes.ts:202-211` — `passport.authenticate("saml", {session:false, failureRedirect})`, standard Passport behavior: `failureRedirect` short-circuits the middleware chain on auth failure | CONFIRMED — fix |
| The `!profile` branch (`loginFail` + `loginAttemptsTotal{outcome:fail}`) is dead code for the rejected-assertion path | `auth.routes.ts:45-58`, only reachable if Passport calls `next()` with no `req.user`, which `failureRedirect` prevents                                                                          | CONFIRMED — fix |
| Rejected SAML assertions are invisible to audit log and metric today                                                  | direct code read; no other code path records SAML `outcome:fail`                                                                                                                                | CONFIRMED — fix |

## Non-goals

- Not changing the client-visible redirect destination or query param
  (`/auth/error?reason=invalid_assertion`) on a rejected assertion — only
  the server-side recording path changes.
- Not touching `saml-provisioning`'s existing create-only provisioning
  requirements (stub creation, no re-sync, role/account-key rules) — this
  change only adds a failure-observability requirement alongside them.
- Not adding new audit-log fields or a new Prometheus label beyond the
  existing `loginFail`/`loginAttemptsTotal{outcome:"fail"}` shape already
  used for post-passport failures.
- Not addressing `saml.samlify.test.ts`'s currently `describe.skip`'d
  integration tests against a mock IdP — out of scope; this change adds its
  own targeted test instead.

## File manifest

- `apps/api/src/modules/auth/auth.routes.ts` — `mountAuthRoutes` (lines
  202-211) and `createSamlCallbackHandler` (lines 40-90)
- Tests:
  - `apps/api/src/modules/auth/auth.routes.saml-rejection.test.ts` (new) —
    exercises the custom-callback wiring with a Passport failure case
  - `apps/api/src/modules/auth/auth.routes.logout.test.ts` (existing,
    unaffected — covers `createLogoutHandler`/`deriveLogoutOrigins` only)
  - `apps/api/src/modules/auth/saml.strategy.test.ts` (existing, unaffected —
    covers `verifySamlProfile`/`createSamlStrategyOptions`, not the route)

## Verification

- `pnpm --filter @customreport/api db:generate && pnpm typecheck && pnpm lint && pnpm test`
- `cd apps/api && pnpm test:integration` — SAML callback wiring touches
  Express route mounting; run the full integration suite to confirm no
  regression in the auth/session integration paths.
- Targeted test: mock `passport.authenticate`'s custom-callback invocation
  with `(err=null, user=false, info={message:"invalid_assertion"})` (the
  shape Passport's SAML strategy uses on a rejected assertion) and assert
  `auditLogger.loginFail` and `loginAttemptsTotal.inc({outcome:"fail"})` are
  both called, then the response redirects to
  `/auth/error?reason=invalid_assertion`.

## Sequencing

No dependency on the other four changes in this batch — `auth.routes.ts` is
not touched by any of them. Can land independently.
