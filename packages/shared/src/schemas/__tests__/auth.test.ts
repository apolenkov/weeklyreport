import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import { roleSchema, userSessionSchema } from "../auth";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const uuid = () => randomUUID();

const validSession = () => ({
  userId: uuid(),
  email: "lead@example.com",
  name: "Test Lead",
  role: "lead" as const,
  activeReportId: uuid(),
  activeReportSectionId: uuid(),
});

// ---------------------------------------------------------------------------
// roleSchema
// ---------------------------------------------------------------------------

describe("roleSchema", () => {
  it('accepts "lead"', () => {
    expect(roleSchema.safeParse("lead").success).toBe(true);
  });

  it('accepts "head"', () => {
    expect(roleSchema.safeParse("head").success).toBe(true);
  });

  it('accepts "viewer"', () => {
    expect(roleSchema.safeParse("viewer").success).toBe(true);
  });

  it('accepts "admin" — Phase 32-C / H-01 widened DB Role enum to include admin', () => {
    expect(roleSchema.safeParse("admin").success).toBe(true);
  });

  it("rejects empty string", () => {
    expect(roleSchema.safeParse("").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// userSessionSchema — core fields
// ---------------------------------------------------------------------------

describe("userSessionSchema — required fields", () => {
  it("accepts valid session with all fields", () => {
    const result = userSessionSchema.safeParse(validSession());
    expect(result.success).toBe(true);
  });

  it("rejects missing userId", () => {
    const { userId, ...rest } = validSession();
    const result = userSessionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing email", () => {
    const { email, ...rest } = validSession();
    const result = userSessionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const { name, ...rest } = validSession();
    const result = userSessionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing role", () => {
    const { role, ...rest } = validSession();
    const result = userSessionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty name (min 1)", () => {
    const session = { ...validSession(), name: "" };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID userId", () => {
    const session = { ...validSession(), userId: "not-a-uuid" };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const session = { ...validSession(), email: "not-an-email" };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// userSessionSchema — nullable JWT fields (BUG-009)
// ---------------------------------------------------------------------------

describe("userSessionSchema — nullable JWT fields (BUG-009)", () => {
  it("accepts activeReportId as null", () => {
    const session = { ...validSession(), activeReportId: null };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activeReportId).toBeNull();
    }
  });

  it("accepts activeReportId as undefined (optional)", () => {
    const { activeReportId, ...rest } = validSession();
    const result = userSessionSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activeReportId).toBeUndefined();
    }
  });

  it("accepts activeReportSectionId as null", () => {
    const session = { ...validSession(), activeReportSectionId: null };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activeReportSectionId).toBeNull();
    }
  });

  it("accepts activeReportSectionId as undefined (optional)", () => {
    const { activeReportSectionId, ...rest } = validSession();
    const result = userSessionSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activeReportSectionId).toBeUndefined();
    }
  });

  it("accepts both nullable fields as null simultaneously", () => {
    const session = {
      ...validSession(),
      activeReportId: null,
      activeReportSectionId: null,
    };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(true);
  });

  it("accepts both nullable fields as undefined (omitted)", () => {
    const { activeReportId, activeReportSectionId, ...rest } = validSession();
    const result = userSessionSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it("accepts valid UUID for activeReportId", () => {
    const session = { ...validSession(), activeReportId: uuid() };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID activeReportId (when not null)", () => {
    const session = { ...validSession(), activeReportId: "not-a-uuid" };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID activeReportSectionId (when not null)", () => {
    const session = { ...validSession(), activeReportSectionId: "bad-id" };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// userSessionSchema — role values
// ---------------------------------------------------------------------------

describe("userSessionSchema — role validation", () => {
  it("accepts each valid session role in context of full session", () => {
    for (const role of ["lead", "head", "admin", "viewer"] as const) {
      const session = { ...validSession(), role };
      const result = userSessionSchema.safeParse(session);
      expect(result.success).toBe(true);
    }
  });

  it("rejects director until the product explicitly introduces that role", () => {
    const session = { ...validSession(), role: "director" };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });

  it("rejects invalid role in session context", () => {
    const session = { ...validSession(), role: "superadmin" };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });
});
