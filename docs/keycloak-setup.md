# Keycloak SAML Setup (Phase 38-03)

This document covers wiring CustomReport (Service Provider) to a customer's
Keycloak (Identity Provider) over SAML 2.0. Real Keycloak deployment and
operation are the customer org's responsibility — this guide describes only
the SAML contract.

## Prerequisites

- A Keycloak realm where CustomReport users live. Realm name → `KEYCLOAK_REALM`.
- A user federation source (LDAP / Active Directory / built-in) populated with
  the operators who will log in.
- A signing certificate for the realm (Keycloak generates one per realm by
  default; reuse it or upload your own).

## Service Provider (CustomReport) parameters

These end up in `.env` / `.env.prod` for the api container:

```bash
# Where Keycloak's POST binding submits the SAML response. Must end in
# /auth/saml/callback (route is mounted in apps/api/src/modules/auth/auth.routes.ts).
KEYCLOAK_SAML_CALLBACK_URL=https://customreport.example.com/auth/saml/callback

# Realm-level SAML SSO endpoint; Keycloak prints this on the realm SAML
# settings page as "Login URL".
KEYCLOAK_SAML_ENTRY_POINT=https://kc.example.com/realms/customreport/protocol/saml

# SP entityID. Must match the "Client ID" field of the Keycloak SAML client
# you create below.
KEYCLOAK_SAML_ISSUER=customreport-prod

# The IdP signing certificate (PEM format) used to verify SAML responses.
# Pull from Keycloak: realm → Realm Settings → Keys → Certificate
# (RS256 row) → Public key. Wrap in BEGIN/END CERTIFICATE markers if not
# already.
KEYCLOAK_SAML_CERT="-----BEGIN CERTIFICATE-----
MIIDazCCAlOgAwIBAgIU...
-----END CERTIFICATE-----"
```

The api boots with `validateEnv()` (apps/api/src/infrastructure/config/env.schema.ts).
Any of these four keys missing under `NODE_ENV=production` aborts startup with
a Zod validation error. The boot fence in `apps/api/src/lib/dev-auth-fence.ts`
additionally refuses to start if `AUTH_DEV_MODE=true` slips through under
production.

## Identity Provider (Keycloak) configuration

### 1. Create the SAML client

In the Keycloak admin UI:

1. **Clients → Create client**
2. **Client type**: SAML
3. **Client ID**: `customreport-prod` (must match `KEYCLOAK_SAML_ISSUER`)
4. **Save**

### 2. Wire the SP endpoints

On the new client's settings tab:

| Field                                    | Value                                                              |
| ---------------------------------------- | ------------------------------------------------------------------ |
| **Valid Redirect URIs**                  | `https://customreport.example.com/auth/saml/callback`              |
| **Master SAML Processing URL**           | `https://customreport.example.com/auth/saml/callback`              |
| **Valid Post Logout Redirect URIs**      | `https://customreport.example.com/`                                |
| **Sign Documents**                       | ON  (signs the entire SAML response — `wantAuthnResponseSigned`)   |
| **Sign Assertions**                      | ON  (`wantAssertionsSigned`)                                       |
| **Signature Algorithm**                  | RSA_SHA256                                                         |
| **Canonicalization Method**              | EXCLUSIVE (default)                                                |
| **Force POST Binding**                   | ON                                                                 |
| **Front Channel Logout**                 | OFF                                                                |
| **Encrypt Assertions**                   | OFF (CustomReport SP does not run encryption — see deferred below) |
| **Client Signature Required**            | OFF (SP-side AuthnRequest signing not configured)                  |
| **Allow ECP Flow**                       | OFF                                                                |
| **Name ID Format**                       | email                                                              |

### 3. Attribute mapping

CustomReport's verifier (`apps/api/src/modules/auth/saml.strategy.ts` →
`verifySamlProfile`) reads four claims:

| CustomReport field     | Keycloak attribute name | Notes                                             |
| ---------------------- | ----------------------- | ------------------------------------------------- |
| `samlId` (`nameID`)    | NameID                  | Used as the unique persistent ID for the User row |
| `email`                | `email`                 | Required; mapped to User.email on first login     |
| `displayName`          | `displayName` or `cn`   | Optional; falls back to "Unknown User"            |
| `role`                 | `role`                  | Required; one of `lead`, `head`, `admin`, `viewer` |

In Keycloak, add these via **Client → Mappers** (or **Client Scopes →
saml → Mappers**):

| Mapper type                | Mapper name        | User attribute / role attribute       | SAML attribute name |
| -------------------------- | ------------------ | ------------------------------------- | ------------------- |
| User Property              | email              | email                                 | email               |
| User Property              | full name          | firstName + lastName                  | displayName         |
| User Realm Role / Hardcoded | role               | (mapped from realm role / group)      | role                |

The `role` attribute MUST resolve to one of the four enum values. Mapping
realm roles → CustomReport roles is up to the org; a typical pattern:

```
Keycloak realm role  →  SAML role attribute value
  cr-admin           →  admin
  cr-head            →  head
  cr-lead            →  lead
  cr-viewer          →  viewer
```

A hardcoded-role mapper or a script-mapper that translates realm roles into
the role attribute is the cleanest way to enforce this.

### 4. Cert exchange

CustomReport's SP pins a single IdP certificate via `KEYCLOAK_SAML_CERT`.
There is no metadata auto-discovery — paste the PEM into env directly.

```bash
# Pull the cert from Keycloak. From the realm:
curl -s https://kc.example.com/realms/customreport/protocol/saml/descriptor \
  | xmllint --xpath \
     "//*[local-name()='X509Certificate']/text()" - \
  | (echo '-----BEGIN CERTIFICATE-----' && fold -w64 && echo '-----END CERTIFICATE-----')
```

Set `KEYCLOAK_SAML_CERT` to the full PEM in `.env.prod`. When Keycloak rotates
the realm key (every N years), update this env value and restart the api.

## SP metadata (optional)

`@node-saml/passport-saml` can emit SP metadata if the customer's IdP needs
it for one-shot import:

```bash
# Inside the api container
node -e "
const { Strategy } = require('@node-saml/passport-saml');
const strat = new Strategy({
  callbackUrl: process.env.KEYCLOAK_SAML_CALLBACK_URL,
  entryPoint: process.env.KEYCLOAK_SAML_ENTRY_POINT,
  issuer: process.env.KEYCLOAK_SAML_ISSUER,
  idpCert: process.env.KEYCLOAK_SAML_CERT,
}, () => {});
console.log(strat.generateServiceProviderMetadata(null));
"
```

Save the output as `customreport-sp-metadata.xml` and import in Keycloak via
**Clients → Import client → Resource file**.

## Testing the round-trip

### Without Keycloak (samlify mock)

`apps/api/src/modules/auth/saml.samlify.test.ts` round-trips a signed
assertion through a samlify mock IdP and asserts:

- A freshly signed response parses cleanly (issuer, audience, nameID populated)
- A response with mutated `<ds:SignatureValue>` is rejected

Plus `apps/api/src/modules/auth/saml.strategy.test.ts` asserts the production
strategy options:

- `idpCert` is pinned from `KEYCLOAK_SAML_CERT` (no fallback in prod)
- `wantAssertionsSigned: true` + `wantAuthnResponseSigned: true`
- `validateInResponseTo: 'always'` (replay-attack rejection via the in-memory
  request-id cache that passport-saml maintains)
- Missing any of the four required env vars throws at strategy construction

Run both:

```bash
pnpm --filter @customreport/api test src/modules/auth/saml.samlify.test.ts \
                                     src/modules/auth/saml.strategy.test.ts
```

### Against a live Keycloak

1. Boot the api with the env vars above.
2. Visit `https://customreport.example.com/auth/saml/login`.
3. Keycloak redirects you to its login page.
4. After successful auth, Keycloak POSTs the signed response to
   `/auth/saml/callback`.
5. The strategy verifies the signature, the `verifySamlProfile` mapper extracts
   the four claims, and the user lands on `/` with a session cookie.

If signature validation fails, you'll see `Invalid response/assertion signature`
in the api logs; check that `KEYCLOAK_SAML_CERT` matches the realm's current
signing cert. If the role attribute is missing, the user gets a
`SAML profile missing required role attribute` failure — verify the role mapper.

## Deferred (v8.1 candidates)

- **Encrypted assertions**: SP currently expects unencrypted XML payload.
  Keycloak's "Encrypt Assertions" toggle is OFF. Re-enabling requires an SP
  key + decryption wiring in `saml.strategy.ts`.
- **SP-signed AuthnRequests**: requires the SP to hold its own signing key
  pair and Keycloak to be configured with "Client Signature Required".
- **Keycloak in CI**: production currently uses customer Keycloak; CI runs
  the samlify mock + strategy unit tests. A live-Keycloak container in CI is
  v8.1 if pre-prod E2E becomes a hard requirement.
- **Just-in-time provisioning**: today the api creates a User row from the
  SAML profile on first login. Mapping changes (e.g. role downgrades from
  Keycloak realm-role updates) are honoured on every login but not on a
  schedule. Webhook-triggered re-sync is a v8.1 ask.
