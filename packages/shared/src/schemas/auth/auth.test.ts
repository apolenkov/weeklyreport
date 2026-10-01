import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { roleSchema, sessionRoleSchema, userSessionSchema } from "./auth.js";

const createValidSession = () => ({
  userId: randomUUID(),
  email: "lead@example.com",
  name: "Test Lead",
  lastName: "Lead",
  firstName: "Test",
  middleName: null,
  role: "lead" as const,
  activeReportId: randomUUID(),
  activeReportSectionId: randomUUID(),
  reportingGroupId: randomUUID(),
  reportingGroupName: "G".repeat(200),
  viewerGroupAccess: [randomUUID()],
  organization: {
    shortName: "O".repeat(16),
    fullName: "O".repeat(200),
  },
});

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

  it('accepts "admin"', () => {
    expect(roleSchema.safeParse("admin").success).toBe(true);
  });

  it("rejects empty string", () => {
    expect(roleSchema.safeParse("").success).toBe(false);
  });

  it.each(["LEAD", "Lead", "director", null, undefined, 1])(
    "rejects %j",
    (role) => {
      expect(roleSchema.safeParse(role).success).toBe(false);
    },
  );
});

describe("role enum option order", () => {
  it("exposes the DB axis in declaration order", () => {
    expect(roleSchema.options).toEqual(["lead", "head", "admin", "viewer"]);
  });

  it("exposes the session axis in the same order", () => {
    expect(sessionRoleSchema.options).toEqual([
      "lead",
      "head",
      "admin",
      "viewer",
    ]);
  });
});

describe("userSessionSchema — required fields", () => {
  it("accepts valid session with all fields", () => {
    const session = createValidSession();
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject(session);
    }
  });

  it("rejects missing userId", () => {
    const { userId, ...rest } = createValidSession();
    const result = userSessionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing email", () => {
    const { email, ...rest } = createValidSession();
    const result = userSessionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const { name, ...rest } = createValidSession();
    const result = userSessionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing role", () => {
    const { role, ...rest } = createValidSession();
    const result = userSessionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty name (min 1)", () => {
    const session = { ...createValidSession(), name: "" };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID userId", () => {
    const session = { ...createValidSession(), userId: "not-a-uuid" };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const session = { ...createValidSession(), email: "not-an-email" };
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(false);
  });
});
