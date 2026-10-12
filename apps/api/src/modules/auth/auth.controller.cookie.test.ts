import { AUTH_COOKIE_NAME } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { createAuthController, createSessionCookie } from "./auth.controller";

const env = {
  AUTH_JWT_SECRET: "phase-01-secret-padded-to-min-32-chars",
  KEYCLOAK_SAML_CALLBACK_URL: "http://localhost:3001/auth/saml/callback",
  KEYCLOAK_SAML_ENTRY_POINT:
    "http://localhost:8080/realms/customreport/protocol/saml",
  KEYCLOAK_SAML_ISSUER: "customreport",
  KEYCLOAK_SAML_CERT: "CERT_DATA",
  NODE_ENV: "test",
} satisfies NodeJS.ProcessEnv;

describe("auth controller", () => {
  it("issues an httpOnly JWT cookie for a valid SAML-derived session", () => {
    const controller = createAuthController(env);
    const issued = controller.issueSessionCookie({
      userId: "11111111-1111-4111-8111-111111111111",
      email: "lead1@customreport.local",
      name: "Lead 1",
      role: "lead",
      activeReportId: "22222222-2222-4222-8222-222222222222",
      activeReportSectionId: "33333333-3333-4333-8333-333333333333",
    });

    expect(issued.setCookieHeader).toContain(`${AUTH_COOKIE_NAME}=`);
    expect(issued.setCookieHeader).toContain("HttpOnly");
  });

  describe("session cookie naming", () => {
    it("createSessionCookie uses the canonical session cookie name", () => {
      const cookie = createSessionCookie({ token: "test-token", env });

      expect(cookie).toContain(`${AUTH_COOKIE_NAME}=`);
      expect(cookie).toContain("HttpOnly");
    });

    it("uses the canonical name without environment configuration", () => {
      const cookie = createSessionCookie({
        token: "test-token",
        env,
      });

      expect(cookie).toContain(`${AUTH_COOKIE_NAME}=`);
    });

    it("issueSessionCookie produces a cookie with the canonical name", () => {
      const controller = createAuthController(env);
      const issued = controller.issueSessionCookie({
        userId: "11111111-1111-4111-8111-111111111111",
        email: "lead1@customreport.local",
        name: "Lead 1",
        role: "lead",
        activeReportId: "22222222-2222-4222-8222-222222222222",
        activeReportSectionId: "33333333-3333-4333-8333-333333333333",
      });

      expect(issued.setCookieHeader).toContain(`${AUTH_COOKIE_NAME}=`);
      expect(issued.setCookieHeader).toContain("HttpOnly");
    });
  });

  describe("logout cookie clearing", () => {
    it("clears the session with an empty value, Max-Age=0 and matching attributes", () => {
      const setCookie = createSessionCookie({ token: "test-token", env });
      const clearCookie = createSessionCookie({
        token: "",
        env,
        maxAgeSeconds: 0,
      });

      // The cleared cookie only replaces the live one if name and scoping
      // attributes match the set cookie exactly.
      expect(clearCookie).toMatch(new RegExp(`^${AUTH_COOKIE_NAME}=;`));
      expect(clearCookie).toContain("Max-Age=0");
      const attributesOf = (cookie: string): string[] =>
        cookie
          .split("; ")
          .slice(1)
          .filter((attr) => !attr.startsWith("Max-Age="))
          .toSorted();
      expect(attributesOf(clearCookie)).toEqual(attributesOf(setCookie));
    });
  });
});
