import { describe, expect, it } from "vitest";

import { SamlProfileSchema } from "./saml-profile";

describe("SamlProfileSchema (AUTH-02 / structured-user-name: role-free)", () => {
  it("parses a valid profile (no role attribute)", () => {
    const result = SamlProfileSchema.parse({
      nameID: "u-1",
      email: "head@example.com",
      displayName: "Head User",
    });
    expect(result.email).toBe("head@example.com");
    expect(result.displayName).toBe("Head User");
  });

  it("accepts a profile without role (role is no longer carried by the assertion)", () => {
    const result = SamlProfileSchema.safeParse({
      nameID: "u-1",
      email: "someone@example.com",
      displayName: "Someone",
    });
    expect(result.success).toBe(true);
  });

  it("parses without displayName (optional)", () => {
    const result = SamlProfileSchema.safeParse({
      nameID: "u-2",
      email: "min@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a role attribute via .strict (role must not leak into the JWT)", () => {
    const result = SamlProfileSchema.safeParse({
      nameID: "u-3",
      email: "role@example.com",
      role: "admin",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an extra unknown attribute (.strict prevents leak into JWT)", () => {
    const result = SamlProfileSchema.safeParse({
      nameID: "u-5",
      email: "x@example.com",
      // Imagine Keycloak misconfiguration emitting the raw assertion XML —
      // .strict() blocks it.
      samlAssertion: "<saml:Assertion>...</saml:Assertion>",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email format", () => {
    const result = SamlProfileSchema.safeParse({
      nameID: "u-6",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });
});
