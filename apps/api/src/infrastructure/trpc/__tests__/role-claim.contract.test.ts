import type { UserSession } from "@customreport/shared";
import { describe, expect, it } from "vitest";
import { createAuthController } from "../../../modules/auth/auth.controller.js";
import {
  type SamlStrategyOptions,
  verifySamlProfile,
} from "../../../modules/auth/saml.strategy.js";

// ---------------------------------------------------------------------------
// AUTH-02 contract test (Phase 29-02): SAML profile.role survives the full
// SAML → JWT → ctx.session.role pipeline. Closes A-2 (silent over-grant via
// undefined role) at every link in the chain.
// ---------------------------------------------------------------------------

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
const prodOptions: SamlStrategyOptions = { ...baseOptions, devMode: false };

const env: NodeJS.ProcessEnv = {
  ...process.env,
  AUTH_JWT_SECRET: "role-claim-contract-test-secret-32",
};

function buildSession(profile: {
  samlId: string;
  email: string;
  displayName: string;
  role: "lead" | "head" | "admin" | "viewer";
}): UserSession {
  return {
    userId: "a0000000-0000-4000-8000-000000000001",
    email: profile.email,
    name: profile.displayName,
    role: profile.role,
    activeReportId: null,
    activeReportSectionId: null,
  };
}

describe("AUTH-02: SAML profile → JWT → session.role round-trip", () => {
  it("a verified head profile produces a JWT decodable to role=head", () => {
    const verified = verifySamlProfile(prodOptions, {
      nameID: "u-head",
      email: "head@customreport.local",
      displayName: "Department Head",
      role: "head",
    });
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;

    const ctrl = createAuthController(env);
    const { token } = ctrl.issueSessionCookie(buildSession(verified.profile));
    const session = ctrl.verifySessionToken(token);

    expect(session.role).toBe("head");
    expect(session.email).toBe("head@customreport.local");
  });

  it("a verified lead profile produces a JWT decodable to role=lead", () => {
    const verified = verifySamlProfile(prodOptions, {
      nameID: "u-lead",
      email: "lead@customreport.local",
      displayName: "Team Lead",
      role: "lead",
    });
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;

    const ctrl = createAuthController(env);
    const { token } = ctrl.issueSessionCookie(buildSession(verified.profile));
    const session = ctrl.verifySessionToken(token);

    expect(session.role).toBe("lead");
  });

  it("admin profile (Phase 27 widening) round-trips via JWT", () => {
    const verified = verifySamlProfile(prodOptions, {
      nameID: "u-admin",
      email: "admin@customreport.local",
      role: "admin",
    });
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;

    const ctrl = createAuthController(env);
    const { token } = ctrl.issueSessionCookie(buildSession(verified.profile));
    const session = ctrl.verifySessionToken(token);

    expect(session.role).toBe("admin");
  });

  it("a SAML profile without role is rejected before any JWT is issued (A-2)", () => {
    const verified = verifySamlProfile(prodOptions, {
      nameID: "u-no-role",
      email: "no-role@customreport.local",
      displayName: "Roleless",
    });
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.message).toContain("missing required role attribute");
  });

  it("mixed-case role (HEAD) round-trips as lowercase head in the session", () => {
    const verified = verifySamlProfile(prodOptions, {
      nameID: "u-mixed",
      email: "mixed@customreport.local",
      role: "HEAD",
    });
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;

    const ctrl = createAuthController(env);
    const { token } = ctrl.issueSessionCookie(buildSession(verified.profile));
    const session = ctrl.verifySessionToken(token);

    expect(session.role).toBe("head");
  });
});
