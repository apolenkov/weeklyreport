import { sessionRoleSchema } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { getSessionRole, isRole } from "./login-page-roles";

/**
 * Guard-parity pins for the role-type spec: the login page's runtime guards
 * keep literal values (deliberately not derived from the schema), so these
 * tests are what fails if `sessionRoleSchema` ever gains a member the guards
 * do not accept.
 */
describe("isRole", () => {
  it("accepts every session role (role-type guard parity)", () => {
    for (const role of sessionRoleSchema.options) {
      expect(isRole(role)).toBe(true);
    }
  });

  it("rejects unknown tokens and non-strings", () => {
    expect(isRole("superuser")).toBe(false);
    expect(isRole("")).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(isRole(42)).toBe(false);
  });
});

describe("getSessionRole", () => {
  it("extracts a valid role from a session-shaped object", () => {
    for (const role of sessionRoleSchema.options) {
      expect(getSessionRole({ role })).toBe(role);
    }
  });

  it("returns undefined for missing or invalid role values", () => {
    expect(getSessionRole(null)).toBeUndefined();
    expect(getSessionRole({})).toBeUndefined();
    expect(getSessionRole({ role: "superuser" })).toBeUndefined();
    expect(getSessionRole("lead")).toBeUndefined();
  });
});
