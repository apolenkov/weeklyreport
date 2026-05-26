import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import { roleSchema, userSessionSchema } from "./auth";

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

  it('rejects "director" until the product explicitly introduces that role', () => {
    expect(roleSchema.safeParse("director").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(roleSchema.safeParse("").success).toBe(false);
  });

  it("rejects null", () => {
    expect(roleSchema.safeParse(null).success).toBe(false);
  });

  it("rejects undefined", () => {
    expect(roleSchema.safeParse(undefined).success).toBe(false);
  });

  it("rejects number", () => {
    expect(roleSchema.safeParse(1).success).toBe(false);
  });

  it('rejects uppercase "LEAD"', () => {
    expect(roleSchema.safeParse("LEAD").success).toBe(false);
  });

  it('rejects "Lead" (mixed case)', () => {
    expect(roleSchema.safeParse("Lead").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// userSessionSchema
// ---------------------------------------------------------------------------

describe("userSessionSchema", () => {
  const validSession = () => ({
    userId: randomUUID(),
    email: "test@example.com",
    name: "Test User",
    role: "lead" as const,
    activeReportId: randomUUID(),
    activeReportSectionId: randomUUID(),
  });

  // --- Happy paths ---

  it("accepts valid lead session", () => {
    const result = userSessionSchema.safeParse(validSession());
    expect(result.success).toBe(true);
  });

  it("accepts valid head session (no activeReportSectionId)", () => {
    const session = {
      ...validSession(),
      role: "head" as const,
      activeReportSectionId: null,
    };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(true);
  });

  it("accepts valid viewer session (no active report or section)", () => {
    const session = {
      ...validSession(),
      role: "viewer" as const,
      activeReportId: null,
      activeReportSectionId: null,
    };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(true);
  });

  it("accepts session without optional activeReportId (field omitted)", () => {
    const { activeReportId, ...rest } = validSession();
    const result = userSessionSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it("accepts session without optional activeReportSectionId (field omitted)", () => {
    const { activeReportSectionId, ...rest } = validSession();
    const result = userSessionSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  // --- userId validation ---

  it("rejects non-UUID userId", () => {
    const session = { ...validSession(), userId: "not-a-uuid" };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });

  it("rejects empty userId", () => {
    const session = { ...validSession(), userId: "" };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });

  it("rejects null userId", () => {
    const session = { ...validSession(), userId: null };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });

  // --- email validation ---

  it("accepts valid email", () => {
    const session = { ...validSession(), email: "user@example.com" };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(true);
  });

  it("rejects invalid email (no @)", () => {
    const session = { ...validSession(), email: "not-an-email" };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const session = { ...validSession(), email: "" };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });

  // --- name validation ---

  it("accepts any non-empty name", () => {
    const session = { ...validSession(), name: "A" };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const session = { ...validSession(), name: "" };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });

  // --- role validation ---

  it("rejects invalid role in session", () => {
    const session = { ...validSession(), role: "superadmin" };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });

  // --- activeReportId validation ---

  it("accepts null activeReportId", () => {
    const session = { ...validSession(), activeReportId: null };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID activeReportId when provided", () => {
    const session = { ...validSession(), activeReportId: "bad-id" };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });

  // --- activeReportSectionId validation ---

  it("accepts null activeReportSectionId", () => {
    const session = { ...validSession(), activeReportSectionId: null };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID activeReportSectionId when provided", () => {
    const session = { ...validSession(), activeReportSectionId: "bad-id" };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });

  // --- Missing required fields ---

  it("rejects when userId is missing", () => {
    const { userId, ...rest } = validSession();
    const result = userSessionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects when email is missing", () => {
    const { email, ...rest } = validSession();
    const result = userSessionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects when name is missing", () => {
    const { name, ...rest } = validSession();
    const result = userSessionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects when role is missing", () => {
    const { role, ...rest } = validSession();
    const result = userSessionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  // --- Type coercion ---

  it("rejects number as email", () => {
    const session = { ...validSession(), email: 12345 };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });

  it("rejects array as name", () => {
    const session = { ...validSession(), name: ["Test"] };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });
});
