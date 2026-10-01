import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { sessionRoleSchema, userSessionSchema } from "./auth.js";

const createValidSession = () => ({
  userId: randomUUID(),
  email: "lead@company.com",
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

describe("userSessionSchema hydrated identity bounds", () => {
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
      userSessionSchema.safeParse({ ...createValidSession(), ...override })
        .success,
    ).toBe(false);
  });

  it("rejects invalid name-part types", () => {
    expect(
      userSessionSchema.safeParse({
        ...createValidSession(),
        firstName: null,
      }).success,
    ).toBe(false);
  });
});

describe("userSessionSchema nullable JWT fields", () => {
  it("accepts nullable or omitted active report identifiers", () => {
    const withNulls = {
      ...createValidSession(),
      activeReportId: null,
      activeReportSectionId: null,
    };
    const {
      activeReportId: _activeReportId,
      activeReportSectionId: _activeReportSectionId,
      ...withoutIds
    } = createValidSession();

    expect(userSessionSchema.safeParse(withNulls).success).toBe(true);
    expect(userSessionSchema.safeParse(withoutIds).success).toBe(true);
  });

  it("preserves null and undefined values", () => {
    const withNull = userSessionSchema.parse({
      ...createValidSession(),
      activeReportId: null,
    });
    const { activeReportId: _activeReportId, ...withoutReportId } =
      createValidSession();
    const withoutValue = userSessionSchema.parse(withoutReportId);

    expect(withNull.activeReportId).toBeNull();
    expect(withoutValue.activeReportId).toBeUndefined();
  });

  it("accepts a valid activeReportId", () => {
    expect(
      userSessionSchema.safeParse({
        ...createValidSession(),
        activeReportId: randomUUID(),
      }).success,
    ).toBe(true);
  });

  it.each([
    ["activeReportId", { activeReportId: "not-a-uuid" }],
    ["activeReportSectionId", { activeReportSectionId: "bad-id" }],
  ])("rejects invalid %s", (_label, override) => {
    expect(
      userSessionSchema.safeParse({ ...createValidSession(), ...override })
        .success,
    ).toBe(false);
  });
});

describe("userSessionSchema role validation", () => {
  it.each(sessionRoleSchema.options)("accepts %s", (role) => {
    expect(
      userSessionSchema.safeParse({ ...createValidSession(), role }).success,
    ).toBe(true);
  });

  it.each(["director", "superadmin"])("rejects %s", (role) => {
    expect(
      userSessionSchema.safeParse({ ...createValidSession(), role }).success,
    ).toBe(false);
  });
});
