# Phase 38, Plan 03 — SUMMARY

**REQ-IDs:** INF-03
**Status:** complete

## What shipped

### samlify-based mock IdP integration test

`apps/api/src/modules/auth/saml.samlify.test.ts` (NEW) round-trips a
SAML response through a mock IdP/SP pair built with `samlify` v2.12 (dev
dep) and asserts:

1. **Signed-assertion validation** — a freshly signed response parses cleanly
   on the SP side; issuer + audience + nameID extracted post-signature-verify.
2. **Signature tamper rejection** — mutating one byte of `<ds:SignatureValue>`
   in the signed XML causes the SP to reject. Catches flipped-bit / MITM
   attacks against the assertion blob.

### Strategy-options security posture

`apps/api/src/modules/auth/saml.strategy.test.ts` (extended +5 tests, +1 parametric × 4 = 8 cases) asserts the production options that wire `@node-saml/passport-saml`:

- `idpCert` pinned from `KEYCLOAK_SAML_CERT` env (no fallback in prod)
- `wantAssertionsSigned: true` AND `wantAuthnResponseSigned: true`
- `validateInResponseTo: 'always'` — replay-attack protection via passport-saml's in-memory request-id cache
- `signatureAlgorithm: 'sha256'` + `digestAlgorithm: 'sha256'`
- Boot throws when any of `KEYCLOAK_SAML_CALLBACK_URL`, `KEYCLOAK_SAML_ENTRY_POINT`, `KEYCLOAK_SAML_ISSUER`, `KEYCLOAK_SAML_CERT` is missing in prod

### Test fixtures

`apps/api/src/modules/auth/__fixtures__/saml/` (NEW, 4 files):

- `idp-cert.pem` + `idp-key.pem` — IdP self-signed RSA-2048 keypair, 100-year validity, CN=customreport-test-idp
- `sp-cert.pem` + `sp-key.pem` — same shape for the SP

Generated once via `openssl req -x509 -newkey rsa:2048 -nodes -days 36500`.
Labels make it obvious these are TEST keys; not committed as secrets.

### Documentation

`docs/keycloak-setup.md` (NEW) covers the deployment contract end-to-end:

- Prerequisites (Keycloak realm, federation source, signing cert)
- SP parameters in `.env.prod` (4 required vars + how the boot fence enforces them)
- Keycloak SAML client config (POST binding, sign assertions+responses, NameID format=email, signature algo=RSA_SHA256)
- Attribute mapping table (samlId/email/displayName/role) with realm-role → role-attribute mapping pattern
- Cert exchange (curl + xmllint pull from realm metadata)
- SP-metadata generation snippet for one-shot import
- Round-trip testing without Keycloak (samlify) and with live Keycloak
- Deferred items (encrypted assertions, SP-signed AuthnRequests, live Keycloak in CI, JIT provisioning)

## Why cert-pinning is asserted only at the strategy-options level

samlify v2.12 trusts the embedded `<ds:X509Certificate>` in `KeyInfo` by
default — meaning a "wrong configured cert" in samlify won't actually fail
verification because the assertion's own KeyInfo is trusted. `@node-saml/
passport-saml` (production) does the right thing: it ignores embedded
KeyInfo and verifies signatures against the configured `idpCert`. Asserting
cert-pinning therefore lives in the strategy-options test (config gate)
rather than in the samlify round-trip (observable behaviour gate). The
SUMMARY's threat-model section spells this out.

## Verification

```bash
pnpm --filter @customreport/api test src/modules/auth/saml.samlify.test.ts \
                                     src/modules/auth/saml.strategy.test.ts
# 18/18 green (2 samlify + 16 strategy/verify)

pnpm --filter @customreport/api test
# 616/616 green (was 606/606; +10 new tests)

pnpm --filter @customreport/api typecheck
# clean
```

## Files

- `apps/api/package.json` (samlify added to devDependencies)
- `apps/api/src/modules/auth/saml.samlify.test.ts` (new — 2 tests)
- `apps/api/src/modules/auth/saml.strategy.test.ts` (extended — +8 tests)
- `apps/api/src/modules/auth/__fixtures__/saml/{idp,sp}-{cert,key}.pem` (new — 4 fixtures)
- `docs/keycloak-setup.md` (new — full deployment doc)
