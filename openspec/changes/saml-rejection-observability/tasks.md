## 1. Route the SAML callback through a custom, always-recording handler

- [x] 1.1 `apps/api/src/modules/auth/auth.routes.ts`: in `mountAuthRoutes`,
      remove `failureRedirect` from the `passport.authenticate("saml", { session: false })`
      options
- [x] 1.2 Replace the options-object call with `passport.authenticate("saml", { session: false }, (err, user, info) => {...})`
      form: on `err` or falsy `user`, call `auditLogger.loginFail({..., reason: "invalid_assertion"})`
      and `loginAttemptsTotal.inc({method:"saml", outcome:"fail"})`, then
      `res.redirect(`${frontendUrl}/auth/error?reason=invalid_assertion`)`
- [x] 1.3 On success (`user` truthy), attach `req.user = user` (or the
      equivalent Passport pattern for a custom callback) and hand off to the
      existing `createSamlCallbackHandler` success path unchanged
- [x] 1.4 Confirm `createSamlCallbackHandler`'s existing `!profile` branch
      (lines 45-58) is now reachable and not dead code — either reuse it
      directly from the new custom callback or fold its logic in without
      duplicating the `loginFail`/`loginAttemptsTotal` calls

## 2. Tests

- [x] 2.1 Add `apps/api/src/modules/auth/auth.routes.saml-rejection.test.ts`:
      simulate a Passport SAML rejection (`err=null, user=false, info={message:"invalid_assertion"}`)
      and assert `auditLogger.loginFail` and
      `loginAttemptsTotal.inc({outcome:"fail"})` are both called and the
      response redirects to `/auth/error?reason=invalid_assertion`
- [x] 2.2 Add a companion case asserting the success path is unaffected: a
      valid profile still reaches session issuance with no `loginFail`/`fail`
      metric recorded

## 3. Spec delta

- [x] 3.1 `saml-provisioning`: ADD a requirement that rejected SAML
      assertions are always audited and metered

## 4. Gates and verification

- [x] 4.1 `pnpm --filter @customreport/api db:generate`
- [x] 4.2 `pnpm typecheck && pnpm lint && pnpm test`
- [x] 4.3 `cd apps/api && pnpm test:integration`
- [x] 4.4 `openspec validate saml-rejection-observability --strict`
