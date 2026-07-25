// SAML signature tests against a samlify mock IdP. The __fixtures__/saml keys
// are self-signed CN=customreport-test-{idp,sp} throwaways, not real secrets.
// Cert-pinning and replay rejection are asserted in saml.strategy.test.ts.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import samlify from "samlify";
import { describe, expect, it } from "vitest";

// samlify requires a `validator` it does not bundle. A permissive one is fine
// here: the minted assertion XML is well-formed by construction and the check
// under test is signature validation, not XSD shape.
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
