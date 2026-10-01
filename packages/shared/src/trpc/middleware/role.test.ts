import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import type { UserSession } from "../../schemas/auth/auth.js";
import { assertRole } from "./role.js";

const baseSession: UserSession = {
  userId: "a0000000-0000-4000-8000-000000000001",
  email: "user@test.local",
  name: "User",
  role: "lead",
  activeReportId: null,
  activeReportSectionId: null,
};

const leadSession: UserSession = { ...baseSession, role: "lead" };
const headSession: UserSession = { ...baseSession, role: "head" };
const adminSession: UserSession = { ...baseSession, role: "admin" };
const viewerSession: UserSession = { ...baseSession, role: "viewer" };

const captureTrpcError = (action: () => unknown): TRPCError => {
  try {
    action();
  } catch (error) {
    if (error instanceof TRPCError) return error;
    throw error;
  }
  throw new Error("Expected action to throw a TRPCError");
};

describe("assertRole authentication failures", () => {
  it("throws UNAUTHORIZED when session is null", () => {
    expect(() => assertRole(null, "head")).toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" }),
    );
  });

  it("throws FORBIDDEN when role does not match (single-role input)", () => {
    expect(() => assertRole(leadSession, "head")).toThrow(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });

  it("thrown errors are TRPCError instances", () => {
    expect(captureTrpcError(() => assertRole(null, "head"))).toBeInstanceOf(
      TRPCError,
    );
    expect(
      captureTrpcError(() => assertRole(leadSession, "head")),
    ).toBeInstanceOf(TRPCError);
  });
});

describe("assertRole allowed roles", () => {
  it("returns the narrowed session when single-role matches", () => {
    const result = assertRole(headSession, "head");
    expect(result).toBe(headSession);
    expect(result.role).toBe("head");
  });

  it("returns the narrowed session when role matches any in array", () => {
    expect(assertRole(headSession, ["head", "admin"])).toBe(headSession);
    expect(assertRole(adminSession, ["head", "admin"])).toBe(adminSession);
  });

  it("rejects roles outside the allowed array (FORBIDDEN)", () => {
    expect(() => assertRole(leadSession, ["head", "admin"])).toThrow(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
    expect(() => assertRole(viewerSession, ["head", "admin"])).toThrow(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });

  it("single-role and array-of-one inputs produce equivalent gates", () => {
    expect(assertRole(headSession, "head")).toBe(headSession);
    expect(assertRole(headSession, ["head"])).toBe(headSession);
    expect(() => assertRole(leadSession, "head")).toThrow(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
    expect(() => assertRole(leadSession, ["head"])).toThrow(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });
});

describe("assertRole error contract", () => {
  it("FORBIDDEN message lists the required role(s)", () => {
    const error = captureTrpcError(() =>
      assertRole(leadSession, ["head", "admin"]),
    );
    expect(error.message).toContain("head");
    expect(error.message).toContain("admin");
  });

  it("UNAUTHORIZED is checked before FORBIDDEN (null session never sees role check)", () => {
    expect(() => assertRole(null, ["lead", "head", "admin", "viewer"])).toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" }),
    );
  });
});
