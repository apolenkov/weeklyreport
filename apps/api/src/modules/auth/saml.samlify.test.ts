// SAML signature tests against a samlify mock IdP. The __fixtures__/saml keys
// are self-signed CN=customreport-test-{idp,sp} throwaways, not real secrets.
// Responses are parsed by the production node-saml strategy below.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import samlify from "samlify";
import { describe, expect, it } from "vitest";

import {
  createSamlStrategy,
  type SamlStrategyOptions,
  verifySamlProfile,
} from "./saml.strategy.js";

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

const IDP_ENTITY_ID = "http://idp.test/metadata";
const SP_ENTITY_ID = "http://sp.test/metadata";
const SP_ACS = "http://sp.test/acs";
const TEST_EMAIL = "saml-user@weeklyreport.test";
const TEST_DISPLAY_NAME = "SAML Test User";

type IdPInstance = ReturnType<typeof samlify.IdentityProvider>;
type SPInstance = ReturnType<typeof samlify.ServiceProvider>;

function buildIdP(
  privateKey: string = idpKey,
  signingCert: string = idpCert,
): IdPInstance {
  return samlify.IdentityProvider({
    entityID: IDP_ENTITY_ID,
    privateKey,
    isAssertionEncrypted: false,
    signingCert,
    encryptCert: signingCert,
    wantAuthnRequestsSigned: false,
    singleSignOnService: [
      {
        Binding: samlify.Constants.wording.binding.post,
        Location: "http://idp.test/sso",
      },
    ],
    singleLogoutService: [
      {
        Binding: samlify.Constants.wording.binding.post,
        Location: "http://idp.test/slo",
      },
    ],
  });
}

function buildSP(useIdpCert: string): SPInstance {
  return samlify.ServiceProvider({
    entityID: SP_ENTITY_ID,
    privateKey: spKey,
    signingCert: spCert,
    encryptCert: spCert,
    wantMessageSigned: true,
    wantAssertionsSigned: true,
    isAssertionEncrypted: false,
    authnRequestsSigned: false,
    assertionConsumerService: [
      {
        Binding: samlify.Constants.wording.binding.post,
        Location: SP_ACS,
      },
    ],
    singleLogoutService: [
      {
        Binding: samlify.Constants.wording.binding.post,
        Location: "http://sp.test/slo",
      },
    ],
    // The IdP cert pinned on the SP side. Any mismatch → signature
    // validation fails closed.
    idpCert: useIdpCert,
  } as Parameters<typeof samlify.ServiceProvider>[0]);
}

function buildParser(validateInResponseTo: "always" | "never") {
  const options: SamlStrategyOptions = {
    devMode: validateInResponseTo === "never",
    callbackUrl: SP_ACS,
    entryPoint: "http://idp.test/sso",
    issuer: SP_ENTITY_ID,
    idpCert,
    validateInResponseTo: validateInResponseTo as NonNullable<
      SamlStrategyOptions["validateInResponseTo"]
    >,
    disableRequestedAuthnContext: true,
    signatureAlgorithm: "sha256",
    digestAlgorithm: "sha256",
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: true,
    acceptedClockSkewMs: 5000,
  };
  const parser = createSamlStrategy(options)._saml;
  if (!parser) throw new Error("Expected the production SAML parser");
  return { options, parser };
}

function responseTemplate(requestId: string) {
  return (template: string) => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60_000);
    const responseId = `_${randomUUID()}`;
    const attributeStatement =
      "<saml:AttributeStatement>" +
      '<saml:Attribute Name="email"><saml:AttributeValue>' +
      `${TEST_EMAIL}</saml:AttributeValue></saml:Attribute>` +
      '<saml:Attribute Name="displayName"><saml:AttributeValue>' +
      `${TEST_DISPLAY_NAME}</saml:AttributeValue></saml:Attribute>` +
      "</saml:AttributeStatement>";
    const assertion = samlify.SamlLib.replaceTagsByValue(template, {
      ID: responseId,
      AssertionID: `_${randomUUID()}`,
      Destination: SP_ACS,
      Audience: SP_ENTITY_ID,
      EntityID: SP_ENTITY_ID,
      SubjectRecipient: SP_ACS,
      Issuer: IDP_ENTITY_ID,
      IssueInstant: now.toISOString(),
      StatusCode: "urn:oasis:names:tc:SAML:2.0:status:Success",
      ConditionsNotBefore: now.toISOString(),
      ConditionsNotOnOrAfter: expiresAt.toISOString(),
      SubjectConfirmationDataNotOnOrAfter: expiresAt.toISOString(),
      NameIDFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
      NameID: TEST_EMAIL,
      InResponseTo: requestId,
      AuthnStatement: "",
      AttributeStatement: "",
    }).replace("</saml:Assertion>", `${attributeStatement}</saml:Assertion>`);
    return {
      id: responseId,
      context: assertion,
    };
  };
}

async function mintResponse(idp: IdPInstance, requestId = ""): Promise<string> {
  const response = await idp.createLoginResponse(
    buildSP(idpCert),
    requestId ? { extract: { request: { id: requestId } } } : { extract: {} },
    "post",
    {},
    responseTemplate(requestId),
  );
  return response.context;
}

async function parseIdentity(response: string) {
  const { parser } = buildParser("never");
  const { profile } = await parser.validatePostResponseAsync({
    SAMLResponse: response,
  });
  return verifySamlProfile(profile);
}

describe("SAML hardening — samlify mock IdP integration", () => {
  it("constructs the mock IdP and certificate-pinned SP metadata", () => {
    const idpMetadata = buildIdP().getMetadata();
    const spMetadata = buildSP(idpCert).getMetadata();

    expect(idpMetadata).toContain('entityID="http://idp.test/metadata"');
    expect(spMetadata).toContain('entityID="http://sp.test/metadata"');
    expect(spMetadata).toContain("X509Certificate");
  });

  it("validates a signed response through the production parser", async () => {
    const identity = await parseIdentity(await mintResponse(buildIdP()));

    expect(identity).toEqual({
      ok: true,
      profile: {
        samlId: TEST_EMAIL,
        email: TEST_EMAIL,
        displayName: TEST_DISPLAY_NAME,
        role: "viewer",
      },
    });
  });

  it("rejects a signed assertion whose covered bytes were mutated", async () => {
    const signed = await mintResponse(buildIdP());
    const xml = Buffer.from(signed, "base64").toString("utf8");
    const mutated = Buffer.from(
      xml.replace(TEST_EMAIL, "attacker@weeklyreport.test"),
    ).toString("base64");

    await expect(parseIdentity(mutated)).rejects.toThrow(/signature/i);
  });

  it("rejects a structurally valid response signed by another certificate", async () => {
    const untrusted = await mintResponse(buildIdP(spKey, spCert));

    await expect(parseIdentity(untrusted)).rejects.toThrow(/signature/i);
  });

  it("rejects replay after consuming the production InResponseTo cache entry", async () => {
    const { parser } = buildParser("always");
    const authnRequest = await parser.getAuthorizeMessageAsync(
      "",
      undefined,
      {},
    );
    const parsedRequest = await buildIdP().parseLoginRequest(
      buildSP(idpCert),
      "redirect",
      { query: authnRequest },
    );
    const requestId = parsedRequest.extract.request?.id;
    if (typeof requestId !== "string") {
      throw new TypeError("Expected the generated AuthnRequest id");
    }
    const response = await mintResponse(buildIdP(), requestId);

    await expect(
      parser.validatePostResponseAsync({ SAMLResponse: response }),
    ).resolves.toMatchObject({ profile: { nameID: TEST_EMAIL } });
    await expect(
      parser.validatePostResponseAsync({ SAMLResponse: response }),
    ).rejects.toThrow(/InResponseTo|validate/i);
  });
});
