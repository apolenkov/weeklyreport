/**
 * SAML signature integration tests using a samlify mock IdP.
 *
 * The live smoke test covers construction and metadata generation. Signed
 * assertion validation and tamper rejection remain explicit deferred cases
 * because the installed crypto stack cannot currently mint a response.
 *
 * Cert-pinning + replay-rejection (validateInResponseTo) are config-level
 * concerns enforced by `@node-saml/passport-saml` itself in production
 * (assertion-level cert pin, in-memory request-id cache). saml.strategy.test.ts
 * asserts the production config sets `idpCert: env.KEYCLOAK_SAML_CERT`,
 * `wantAssertionsSigned: true`, `wantAuthnResponseSigned: true`, and
 * `validateInResponseTo: 'always'` — i.e. the spec-required security
 * primitives are wired. samlify is permissive about embedded KeyInfo certs
 * (it trusts them by default) so cert-pinning isn't observable through the
 * mock; the strategy-options test is the right level for that claim.
 *
 * Fixtures: idp-cert.pem / idp-key.pem (RSA-2048, self-signed, 100-year
 * validity) + sp-cert.pem / sp-key.pem under __fixtures__/saml/. Generated
 * once via `openssl req -x509 -newkey rsa:2048 -nodes -days 36500`. Not
 * real secrets — labelled CN=customreport-test-{idp,sp}.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import samlify from "samlify";
import { describe, expect, it } from "vitest";

// `validator` shipped by samlify is required-but-not-bundled to avoid the
// xmldom transitive surface. We swap in a permissive validator for tests
// because the assertion XML we mint is well-formed by construction; the
// security check we care about is signature validation, not XSD shape.
const noopValidator = {
  validate: () => Promise.resolve("skipped"),
};
samlify.setSchemaValidator(noopValidator);

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "__fixtures__/saml");

const idpKey = readFileSync(resolve(fixtures, "idp-key.pem"), "utf8");
const idpCert = readFileSync(resolve(fixtures, "idp-cert.pem"), "utf8");
const spKey = readFileSync(resolve(fixtures, "sp-key.pem"), "utf8");
const spCert = readFileSync(resolve(fixtures, "sp-cert.pem"), "utf8");

type IdPInstance = ReturnType<typeof samlify.IdentityProvider>;
type SPInstance = ReturnType<typeof samlify.ServiceProvider>;

function buildIdP(): IdPInstance {
  return samlify.IdentityProvider({
    entityID: "http://idp.test/metadata",
    privateKey: idpKey,
    privateKeyPass: undefined,
    isAssertionEncrypted: false,
    signingCert: idpCert,
    encryptCert: idpCert,
    wantAuthnRequestsSigned: false,
    singleSignOnService: [
      {
        Binding: samlify.Constants.wording.binding.post,
        Location: "http://idp.test/sso",
      },
    ],
  });
}

function buildSP(useIdpCert: string): SPInstance {
  return samlify.ServiceProvider({
    entityID: "http://sp.test/metadata",
    privateKey: spKey,
    privateKeyPass: undefined,
    signingCert: spCert,
    encryptCert: spCert,
    wantMessageSigned: false,
    wantAssertionsSigned: true,
    isAssertionEncrypted: false,
    authnRequestsSigned: false,
    assertionConsumerService: [
      {
        Binding: samlify.Constants.wording.binding.post,
        Location: "http://sp.test/acs",
      },
    ],
    // The IdP cert pinned on the SP side. Any mismatch → signature
    // validation fails closed.
    idpCert: useIdpCert,
  } as Parameters<typeof samlify.ServiceProvider>[0]);
}

describe("SAML hardening — samlify mock IdP integration", () => {
  it("constructs the mock IdP and certificate-pinned SP metadata", () => {
    const idpMetadata = buildIdP().getMetadata();
    const spMetadata = buildSP(idpCert).getMetadata();

    expect(idpMetadata).toContain('entityID="http://idp.test/metadata"');
    expect(spMetadata).toContain('entityID="http://sp.test/metadata"');
    expect(spMetadata).toContain("X509Certificate");
  });

  // xml-crypto@6.1.2 cannot mint either response under @xmldom/xmldom@0.9
  // because it omits the required MIME type. Patching that production SAML
  // dependency requires regression coverage outside this mock-only suite.
  it.todo("validates and parses a freshly signed assertion");
  it.todo("rejects a signed assertion whose signature bytes were mutated");
});
