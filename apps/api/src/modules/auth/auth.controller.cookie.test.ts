import { describe, expect, it } from "vitest";

import { createAuthController, createSessionCookie } from "./auth.controller";

const env = {
  AUTH_JWT_SECRET: "phase-01-secret-padded-to-min-32-chars",
  AUTH_JWT_COOKIE_NAME: "customreport_session",
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

    expect(issued.setCookieHeader).toContain("customreport_session=");
    expect(issued.setCookieHeader).toContain("HttpOnly");
  });

  describe("session cookie naming", () => {
    it("createSessionCookie uses AUTH_JWT_COOKIE_NAME from env", () => {
      const cookie = createSessionCookie({ token: "test-token", env });

      expect(cookie).toContain("customreport_session=");
      expect(cookie).toContain("HttpOnly");
    });

    it("uses custom cookie name when AUTH_JWT_COOKIE_NAME is set", () => {
      const customEnv = { ...env, AUTH_JWT_COOKIE_NAME: "custom_session" };
      const cookie = createSessionCookie({
        token: "test-token",
        env: customEnv,
      });

      expect(cookie).toContain("custom_session=");
      expect(cookie).not.toContain("customreport_session=");
    });

    it("falls back to customreport_session when AUTH_JWT_COOKIE_NAME is not set", () => {
      const envWithout = { ...env } as NodeJS.ProcessEnv;
      delete envWithout.AUTH_JWT_COOKIE_NAME;
      const cookie = createSessionCookie({
        token: "test-token",
        env: envWithout,
      });

      expect(cookie).toContain("customreport_session=");
    });

    it("issueSessionCookie produces a cookie with the configured name", () => {
      const customEnv = { ...env, AUTH_JWT_COOKIE_NAME: "my_app_cookie" };
      const controller = createAuthController(customEnv);
      const issued = controller.issueSessionCookie({
        userId: "11111111-1111-4111-8111-111111111111",
        email: "lead1@customreport.local",
        name: "Lead 1",
        role: "lead",
        activeReportId: "22222222-2222-4222-8222-222222222222",
        activeReportSectionId: "33333333-3333-4333-8333-333333333333",
      });

      expect(issued.setCookieHeader).toContain("my_app_cookie=");
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
      expect(clearCookie).toMatch(/^customreport_session=;/);
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
