import { describe, expect, it } from "vitest";

import {
  createSamlStrategyOptions,
  type SamlStrategyOptions,
  verifySamlProfile,
} from "./saml.strategy.js";

const baseOptions = {
  callbackUrl: "http://localhost/callback",
  entryPoint: "http://localhost/entry",
  issuer: "test-issuer",
  idpCert: "CERT",
  validateInResponseTo: "never",
  disableRequestedAuthnContext: true,
  signatureAlgorithm: "sha256",
  digestAlgorithm: "sha256",
  wantAssertionsSigned: true,
  wantAuthnResponseSigned: true,
  acceptedClockSkewMs: 0,
} as unknown as SamlStrategyOptions;

const devOptions: SamlStrategyOptions = { ...baseOptions, devMode: true };
const prodOptions: SamlStrategyOptions = { ...baseOptions, devMode: false };

describe("verifySamlProfile (AUTH-02)", () => {
  describe("devMode=true (legacy fallback preserved)", () => {
    it("missing role defaults to viewer (Phase 26 ergonomics)", () => {
      const result = verifySamlProfile(devOptions, {
        nameID: "u-1",
        email: "u@example.com",
        displayName: "U",
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.profile.role).toBe("viewer");
    });

    it("honours role when present", () => {
      const result = verifySamlProfile(devOptions, {
        nameID: "u-2",
        email: "h@example.com",
        role: "head",
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.profile.role).toBe("head");
    });

    it("normalises mixed-case role even in dev mode", () => {
      const result = verifySamlProfile(devOptions, {
        nameID: "u-3",
        email: "h@example.com",
        role: "HEAD",
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.profile.role).toBe("head");
    });
  });

  describe("devMode=false (production strict path)", () => {
    it("rejects a profile without a role attribute (A-2 mitigation)", () => {
      const result = verifySamlProfile(prodOptions, {
        nameID: "u-1",
        email: "u@example.com",
        displayName: "U",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain(
          "missing required role attribute",
        );
      }
    });

    it("accepts a valid head profile", () => {
      const result = verifySamlProfile(prodOptions, {
        nameID: "u-2",
        email: "head@example.com",
        displayName: "Head",
        role: "head",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.profile.role).toBe("head");
        expect(result.profile.email).toBe("head@example.com");
        expect(result.profile.samlId).toBe("u-2");
      }
    });

    it("normalises uppercase role (HEAD → head)", () => {
      const result = verifySamlProfile(prodOptions, {
        nameID: "u-3",
        email: "h@example.com",
        role: "HEAD",
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.profile.role).toBe("head");
    });

    it("rejects an unrecognised role value", () => {
      const result = verifySamlProfile(prodOptions, {
        nameID: "u-4",
        email: "bad@example.com",
        role: "superuser",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain(
          "missing required role attribute",
        );
      }
    });

    it("rejects a missing profile", () => {
      const result = verifySamlProfile(prodOptions, null);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("SAML profile is missing");
      }
    });
  });
});

/**
 * 38-03 — production strategy-options security posture.
 *
 * Asserts the prod-mode options that wire @node-saml/passport-saml hard-pin
 * the IdP cert from env, demand signed assertions+responses, validate
 * InResponseTo (replay protection), and refuse to start when any required
 * SAML env var is missing.
 */
describe("createSamlStrategyOptions — production posture (38-03)", () => {
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
