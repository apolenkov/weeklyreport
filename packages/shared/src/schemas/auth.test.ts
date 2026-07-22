import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { roleSchema, userSessionSchema } from "./auth";

const uuid = () => randomUUID();

const validSession = () => ({
  userId: uuid(),
  email: "lead@company.com",
  name: "Test Lead",
  lastName: "Lead",
  firstName: "Test",
  middleName: null,
  role: "lead" as const,
  activeReportId: uuid(),
  activeReportSectionId: uuid(),
  reportingGroupId: uuid(),
  reportingGroupName: "G".repeat(200),
  viewerGroupAccess: [uuid()],
  organization: {
    shortName: "O".repeat(16),
    fullName: "O".repeat(200),
  },
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

// ---------------------------------------------------------------------------
// userSessionSchema — core fields
// ---------------------------------------------------------------------------

describe("userSessionSchema — required fields", () => {
  it("accepts valid session with all fields", () => {
    const session = validSession();
    const result = userSessionSchema.safeParse(session);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject(session);
    }
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

describe("userSessionSchema — hydrated identity bounds", () => {
  it.each([
    ["reporting group name", { reportingGroupName: "" }],
    ["long reporting group name", { reportingGroupName: "G".repeat(201) }],
    [
      "empty organization short name",
      { organization: { shortName: "", fullName: "Org" } },
    ],
    [
      "long organization short name",
      { organization: { shortName: "O".repeat(17), fullName: "Org" } },
    ],
    [
      "empty organization full name",
      { organization: { shortName: "Org", fullName: "" } },
    ],
    [
      "long organization full name",
      { organization: { shortName: "Org", fullName: "O".repeat(201) } },
    ],
    ["invalid viewer group access", { viewerGroupAccess: ["not-a-uuid"] }],
  ])("rejects %s", (_label, override) => {
    expect(
      userSessionSchema.safeParse({ ...validSession(), ...override }).success,
    ).toBe(false);
  });

  it("rejects invalid name-part types", () => {
    expect(
      userSessionSchema.safeParse({ ...validSession(), firstName: null })
        .success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// userSessionSchema — nullable JWT fields
// ---------------------------------------------------------------------------

describe("userSessionSchema — nullable JWT fields", () => {
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
