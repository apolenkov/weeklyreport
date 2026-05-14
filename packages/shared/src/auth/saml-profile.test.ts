import { describe, expect, it } from "vitest";

import { SamlProfileSchema } from "./saml-profile";

describe("SamlProfileSchema (AUTH-02)", () => {
  it("parses a valid head profile", () => {
    const result = SamlProfileSchema.parse({
      nameID: "u-1",
      email: "head@example.com",
      displayName: "Head User",
      role: "head",
    });
    expect(result.role).toBe("head");
    expect(result.email).toBe("head@example.com");
  });

  it("rejects a profile missing the role attribute (A-2 mitigation)", () => {
    const result = SamlProfileSchema.safeParse({
      nameID: "u-1",
      email: "someone@example.com",
      displayName: "Someone",
    });
    expect(result.success).toBe(false);
  });

  it("normalises uppercase role (HEAD → head)", () => {
    const result = SamlProfileSchema.parse({
      nameID: "u-2",
      email: "mix@example.com",
      role: "HEAD",
    });
    expect(result.role).toBe("head");
  });

  it("normalises mixed-case role (Lead → lead)", () => {
    const result = SamlProfileSchema.parse({
      nameID: "u-3",
      email: "lead@example.com",
      role: "Lead",
    });
    expect(result.role).toBe("lead");
  });

  it("rejects an unrecognised role value", () => {
    const result = SamlProfileSchema.safeParse({
      nameID: "u-4",
      email: "bad@example.com",
      role: "superuser",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an extra unknown attribute (.strict prevents leak into JWT)", () => {
    const result = SamlProfileSchema.safeParse({
      nameID: "u-5",
      email: "x@example.com",
      role: "viewer",
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
      role: "viewer",
    });
    expect(result.success).toBe(false);
  });

  it("accepts admin role (Phase 27 widening preserved)", () => {
    const result = SamlProfileSchema.parse({
      nameID: "u-7",
      email: "admin@example.com",
      role: "admin",
    });
    expect(result.role).toBe("admin");
  });
});
