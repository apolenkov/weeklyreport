import { describe, expect, it } from "vitest";

import {
  createSamlStrategyOptions,
  hasSamlEnv,
  verifySamlProfile,
} from "./saml.strategy.js";

const devEnv = {
  NODE_ENV: "development",
  AUTH_DEV_MODE: "true",
  KEYCLOAK_SAML_CALLBACK_URL: "http://localhost:3001/auth/saml/callback",
  KEYCLOAK_SAML_ENTRY_POINT: "http://localhost:8080/realms/dev/protocol/saml",
  KEYCLOAK_SAML_ISSUER: "customreport-dev",
  KEYCLOAK_SAML_CERT: "DEV_CERT",
} as unknown as NodeJS.ProcessEnv;

describe("verifySamlProfile", () => {
  it("accepts a profile without a role attribute and defaults to viewer", () => {
    const result = verifySamlProfile({
      nameID: "u-1",
      email: "u@example.com",
      displayName: "U",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.role).toBe("viewer");
      expect(result.profile.email).toBe("u@example.com");
      expect(result.profile.samlId).toBe("u-1");
    }
  });

  it("ignores an asserted role attribute and still defaults to viewer", () => {
    const result = verifySamlProfile({
      nameID: "u-2",
      email: "head@example.com",
      displayName: "Head",
      role: "head",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.role).toBe("viewer");
      expect(result.profile.email).toBe("head@example.com");
      expect(result.profile.samlId).toBe("u-2");
    }
  });

  it("rejects a profile missing nameID/email", () => {
    const result = verifySamlProfile({
      displayName: "No Identity",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain(
        "missing required nameID/email attribute",
      );
    }
  });

  it("rejects a missing profile", () => {
    const result = verifySamlProfile(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("SAML profile is missing");
    }
  });

  it("rejects a profile without a displayName instead of provisioning a placeholder", () => {
    const result = verifySamlProfile({
      nameID: "u-3",
      email: "nameless@example.com",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("missing displayName attribute");
    }
  });

  it("rejects a blank/whitespace displayName the same way", () => {
    const result = verifySamlProfile({
      nameID: "u-4",
      email: "blank@example.com",
      displayName: " ".repeat(3),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("missing displayName attribute");
    }
  });
});

// Prod options hard-pin IdP cert, demand signed assertions/responses, validate InResponseTo.
describe("createSamlStrategyOptions — production posture", () => {
  const prodEnv = {
    NODE_ENV: "production",
    AUTH_DEV_MODE: "false",
    KEYCLOAK_SAML_CALLBACK_URL:
      "https://customreport.example.com/auth/saml/callback",
    KEYCLOAK_SAML_ENTRY_POINT: "https://kc.example.com/realms/p/protocol/saml",
    KEYCLOAK_SAML_ISSUER: "customreport-prod",
    KEYCLOAK_SAML_CERT: "-----BEGIN CERT-----\nMIIB...\n-----END CERT-----",
  } as unknown as NodeJS.ProcessEnv;

  it("pins idpCert from env (no fallback in production)", () => {
    const opts = createSamlStrategyOptions(prodEnv);
    expect(opts.idpCert).toBe(prodEnv.KEYCLOAK_SAML_CERT);
    expect(opts.devMode).toBe(false);
  });

  it("demands signed assertions AND signed authn responses", () => {
    const opts = createSamlStrategyOptions(prodEnv);
    expect(opts.wantAssertionsSigned).toBe(true);
    expect(opts.wantAuthnResponseSigned).toBe(true);
  });

  it("validates InResponseTo always (replay-attack rejection)", () => {
    const opts = createSamlStrategyOptions(prodEnv);
    expect(opts.validateInResponseTo).toBe("always");
  });

  it("uses sha256 for both signature and digest algorithms", () => {
    const opts = createSamlStrategyOptions(prodEnv);
    expect(opts.signatureAlgorithm).toBe("sha256");
    expect(opts.digestAlgorithm).toBe("sha256");
  });

  it.each([
    "KEYCLOAK_SAML_CALLBACK_URL",
    "KEYCLOAK_SAML_ENTRY_POINT",
    "KEYCLOAK_SAML_ISSUER",
    "KEYCLOAK_SAML_CERT",
  ])("throws when %s is missing in production", (key) => {
    // Build env without the key via destructuring rest, avoiding the
    // dynamic `delete` (no-dynamic-delete) operator.
    const { [key]: _omitted, ...env } = prodEnv as Record<string, unknown>;
    expect(() => createSamlStrategyOptions(env as NodeJS.ProcessEnv)).toThrow(
      `Missing required environment variable: ${key}`,
    );
  });
});

describe("createSamlStrategyOptions — development posture", () => {
  it("uses explicit development SAML configuration without weakening signatures", () => {
    const opts = createSamlStrategyOptions(devEnv);

    expect(opts).toMatchObject({
      devMode: true,
      callbackUrl: devEnv.KEYCLOAK_SAML_CALLBACK_URL,
      entryPoint: devEnv.KEYCLOAK_SAML_ENTRY_POINT,
      issuer: devEnv.KEYCLOAK_SAML_ISSUER,
      idpCert: devEnv.KEYCLOAK_SAML_CERT,
      validateInResponseTo: "never",
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: true,
    });
  });

  it.each([
    "KEYCLOAK_SAML_CALLBACK_URL",
    "KEYCLOAK_SAML_ENTRY_POINT",
    "KEYCLOAK_SAML_ISSUER",
    "KEYCLOAK_SAML_CERT",
  ])("throws when %s is missing in development", (key) => {
    const { [key]: _omitted, ...env } = devEnv as Record<string, unknown>;

    expect(() => createSamlStrategyOptions(env as NodeJS.ProcessEnv)).toThrow(
      `Missing required environment variable: ${key}`,
    );
  });
});

describe("hasSamlEnv", () => {
  it("is true when all four SAML variables are present", () => {
    expect(hasSamlEnv(devEnv)).toBe(true);
  });

  it.each([
    "KEYCLOAK_SAML_CALLBACK_URL",
    "KEYCLOAK_SAML_ENTRY_POINT",
    "KEYCLOAK_SAML_ISSUER",
    "KEYCLOAK_SAML_CERT",
  ])(
    "stays true when only %s is absent — a partial set must reach requireEnv and fail loud, not degrade to dev-login",
    (key) => {
      const { [key]: _omitted, ...env } = devEnv as Record<string, unknown>;

      expect(hasSamlEnv(env as NodeJS.ProcessEnv)).toBe(true);
    },
  );

  it("is false when no SAML variable is present", () => {
    const {
      KEYCLOAK_SAML_CALLBACK_URL: _cb,
      KEYCLOAK_SAML_ENTRY_POINT: _ep,
      KEYCLOAK_SAML_ISSUER: _iss,
      KEYCLOAK_SAML_CERT: _cert,
      ...env
    } = devEnv as Record<string, unknown>;

    expect(hasSamlEnv(env as NodeJS.ProcessEnv)).toBe(false);
  });

  it("treats whitespace-only values as absent", () => {
    expect(
      hasSamlEnv({
        KEYCLOAK_SAML_CALLBACK_URL: " ".repeat(3),
        KEYCLOAK_SAML_ENTRY_POINT: "",
      }),
    ).toBe(false);
  });
});
