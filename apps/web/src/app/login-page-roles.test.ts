import { ROLE_HOME_PATH, sessionRoleSchema } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  defaultRedirectFor,
  devLoginHref,
  FALLBACK_REDIRECT,
  getSessionRole,
  isRole,
} from "./login-page-roles";

describe("login navigation helpers", () => {
  it("builds an encoded dev-login URL with the role home redirect", () => {
    const href = devLoginHref("head", "head+qa@example.test");
    const url = new URL(href, "http://web.test");

    expect(url.pathname).toBe("/auth/dev-login");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      role: "head",
      email: "head+qa@example.test",
      redirect: ROLE_HOME_PATH.head,
    });
  });

  it("returns each known role's canonical home path", () => {
    for (const role of sessionRoleSchema.options) {
      expect(defaultRedirectFor(role)).toBe(ROLE_HOME_PATH[role]);
    }
  });

  it("falls back for absent and retired persisted roles", () => {
    expect(defaultRedirectFor(null)).toBe(FALLBACK_REDIRECT);
    expect(defaultRedirectFor(undefined)).toBe(FALLBACK_REDIRECT);
    expect(defaultRedirectFor("retired")).toBe(FALLBACK_REDIRECT);
  });
});

// Guard-parity tests pin the schema-derived role set and rejection of
// non-role inputs.
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
