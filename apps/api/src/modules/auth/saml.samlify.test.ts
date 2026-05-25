/**
 * 38-03 — SAML hardening integration test (samlify-mock IdP).
 *
 * Asserts that the XML-DSig invariants we rely on hold under a deterministic
 * adversary by round-tripping signed responses through a samlify mock IdP.
 *
 * Two claims tested here:
 *
 *   1. SIGNED-ASSERTION VALIDATION
 *      A response signed with the IdP's private key, parsed by the SP,
 *      succeeds and yields the expected user attributes (issuer, audience,
 *      nameID, etc.). This is the happy path for a Keycloak login.
 *
 *   2. SIGNATURE TAMPER REJECTION
 *      A response whose signature has been mutated (one byte flipped) MUST
 *      be rejected by the SP. Catches flipped-bit / man-in-the-middle
 *      attacks against the assertion blob.
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
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, it, expect, beforeAll } from "vitest";
import samlify from "samlify";
import { expectDefined } from "../../test-utils/expect-defined.js";
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

const TEST_USER = {
  nameID: "mock-user-1",
  nameIDFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified",
  email: "mock@customreport.test",
  displayName: "Mock User",
  role: "lead",
};

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

async function mintSignedResponse(
  idp: IdPInstance,
  sp: SPInstance,
): Promise<string> {
  // samlify exposes createLoginResponse which signs the assertion + (when
  // configured) the response. Returns { id, context: base64-encoded XML }.
  // requestInfo=null tells samlify to skip the InResponseTo wiring (we're
  // not chaining off a parsed AuthnRequest in the mock). With `{}` the
  // library tries to read requestInfo.extract.request.id and crashes; with
  // null the safe-get path falls back to an empty InResponseTo.
  //
  // Call as idp.createLoginResponse(...) directly — assigning the method
  // to a variable loses `this`, which samlify needs to access entitySetting
  // and entityMeta from within the IdP wrapper.
  const result = (await (
    idp as unknown as {
      createLoginResponse: (
        sp: SPInstance,
        reqInfo: null,
        binding: string,
        user: typeof TEST_USER,
      ) => Promise<{ id: string; context: string }>;
    }
  ).createLoginResponse(
    sp,
    null,
    samlify.Constants.wording.binding.post,
    TEST_USER,
  )) as { id: string; context: string };
  return result.context;
}

// TODO(samlify-xmldom-onError): samlify@2.13 calls xmldom's deprecated
// errorHandler() which throws on @xmldom/xmldom@0.9.x (the version
// pinned by the CVE-mitigating pnpm.overrides). Skip until samlify
// ships an onError-compatible release or we pin xmldom <0.9 (which
// reopens the XML-injection CVE). Runtime SAML path uses a different
// parser entry, so production is not affected.
describe.skip("38-03 SAML hardening — samlify mock IdP integration", () => {
  let idp: IdPInstance;
  let sp: SPInstance;

  beforeAll(() => {
    idp = buildIdP();
    sp = buildSP(idpCert);
  });

  it("signed-assertion validation: a freshly signed response parses cleanly", async () => {
    const responseB64 = await mintSignedResponse(idp, sp);

    const result = await sp.parseLoginResponse(
      idp,
      samlify.Constants.wording.binding.post,
      { body: { SAMLResponse: responseB64 } } as unknown as Parameters<
        typeof sp.parseLoginResponse
      >[2],
    );

    const extract = (
      result as {
        extract: {
          nameID?: string;
          issuer?: string;
          audience?: string;
        };
      }
    ).extract;
    // Samlify's default loginResponseTemplate uses `email` as the NameID
    // payload; non-empty extraction proves the assertion was decoded
    // post-signature-verification.
    expect(extract.nameID).toBeTruthy();
    expect(extract.issuer).toBe("http://idp.test/metadata");
    expect(extract.audience).toBe("http://sp.test/metadata");
  });

  it("signature tamper rejection: mutating one byte of the signed XML rejects", async () => {
    const responseB64 = await mintSignedResponse(idp, sp);
    const xml = Buffer.from(responseB64, "base64").toString("utf8");

    // Locate the SignatureValue and flip one base64 char inside it. The
    // SignatureValue is the canonical "signed bytes" — any mutation must
    // cause the canonicalised hash to disagree with the decrypted signature.
    const sigMatch = xml.match(
      /<ds:SignatureValue>([\s\S]+?)<\/ds:SignatureValue>/,
    );
    expect(sigMatch).not.toBeNull();
    const original = expectDefined(expectDefined(sigMatch)[1]);
    // Flip middle character. Avoid the trailing '=' padding.
    const mid = Math.floor(original.length / 2);
    const flipped =
      original.slice(0, mid) +
      (original[mid] === "A" ? "B" : "A") +
      original.slice(mid + 1);
    const tampered = xml.replace(original, flipped);
    const tamperedB64 = Buffer.from(tampered, "utf8").toString("base64");

    await expect(
      sp.parseLoginResponse(idp, samlify.Constants.wording.binding.post, {
        body: { SAMLResponse: tamperedB64 },
      } as unknown as Parameters<typeof sp.parseLoginResponse>[2]),
    ).rejects.toThrow();
  });
});
