import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import type { UserSession } from "../../schemas/auth";
import { assertRole } from "./role";

// ---------------------------------------------------------------------------
// Unit tests target `assertRole` — the pure role-check contract that
// `requireRole` wraps into a tRPC middleware. The wrapper is exercised at
// integration level via apps/api/src/infrastructure/trpc/trpc.middleware.test.ts
// (existing headProcedure scenarios) plus the AUTH-03 default-deny coverage
// test. assertRole is what enforces the actual UNAUTHORIZED / FORBIDDEN
// semantics — testing it directly keeps coverage tight and decoupled from
// tRPC internals.
// ---------------------------------------------------------------------------

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

describe("assertRole (requireRole core)", () => {
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
    try {
      assertRole(null, "head");
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
    }
    try {
      assertRole(leadSession, "head");
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
    }
  });

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

  it("FORBIDDEN message lists the required role(s)", () => {
    try {
      assertRole(leadSession, ["head", "admin"]);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).message).toContain("head");
      expect((err as TRPCError).message).toContain("admin");
    }
  });

  it("UNAUTHORIZED is checked before FORBIDDEN (null session never sees role check)", () => {
    // Even with a wide allowed-set that would accept any role, null session
    // must trip UNAUTHORIZED, not FORBIDDEN — this is the security ordering
    // contract: missing session is "who are you" before "what can you do".
    expect(() => assertRole(null, ["lead", "head", "admin", "viewer"])).toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" }),
    );
  });
});
