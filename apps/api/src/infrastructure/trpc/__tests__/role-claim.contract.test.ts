import type { Role } from "@customreport/shared";
import type { UserSession } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { createAuthController } from "../../../modules/auth/index.js";
import {
  type SamlStrategyOptions,
  verifySamlProfile,
} from "../../../modules/auth/index.js";

// SAML carries no role; verifySamlProfile defaults every provisioned user to
// viewer (least privilege). Pin that through SAML → JWT → ctx.session.role.

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
  role: Role;
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

describe("SAML profile → JWT → session.role round-trip (role-free)", () => {
  it("an asserted head role is ignored — the session round-trips as viewer", () => {
    const verified = verifySamlProfile(prodOptions, {
      nameID: "u-head",
      email: "head@customreport.local",
      displayName: "Department Head",
      role: "head",
    });
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.profile.role).toBe("viewer");

    const ctrl = createAuthController(env);
    const { token } = ctrl.issueSessionCookie(buildSession(verified.profile));
    const session = ctrl.verifySessionToken(token);

    expect(session.role).toBe("viewer");
    expect(session.email).toBe("head@customreport.local");
  });

  it("a role-less profile is accepted and round-trips as viewer (least privilege)", () => {
    const verified = verifySamlProfile(prodOptions, {
      nameID: "u-no-role",
      email: "no-role@customreport.local",
      displayName: "Roleless",
    });
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.profile.role).toBe("viewer");

    const ctrl = createAuthController(env);
    const { token } = ctrl.issueSessionCookie(buildSession(verified.profile));
    const session = ctrl.verifySessionToken(token);

    expect(session.role).toBe("viewer");
  });

  it("an asserted admin role does not over-grant — session is still viewer", () => {
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

    expect(session.role).toBe("viewer");
  });
});

// Zod `.parse()` strips unknown keys; if name parts were omitted from the
// schema they would vanish silently with a green typecheck.
describe("session name parts survive sign → verify (not Zod-stripped)", () => {
  it("round-trips lastName / firstName / middleName intact", () => {
    const ctrl = createAuthController(env);
    const session: UserSession = {
      userId: "a0000000-0000-4000-8000-000000000009",
      email: "parts@customreport.local",
      name: "Иванов Пётр Сергеевич",
      lastName: "Иванов",
      firstName: "Пётр",
      middleName: "Сергеевич",
      role: "viewer",
      activeReportId: null,
      activeReportSectionId: null,
    };

    const { token } = ctrl.issueSessionCookie(session);
    const verified = ctrl.verifySessionToken(token);

    expect(verified.lastName).toBe("Иванов");
    expect(verified.firstName).toBe("Пётр");
    expect(verified.middleName).toBe("Сергеевич");
    expect(verified.name).toBe("Иванов Пётр Сергеевич");
  });
});
