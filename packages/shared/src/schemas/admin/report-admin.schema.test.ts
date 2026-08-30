import { describe, expect, it } from "vitest";

import { adminSnapshotSchema } from "./report-admin.schema";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GROUP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function snapshotWithUser(user: Record<string, unknown>) {
  return {
    users: [user],
    groups: [],
    projects: [],
    periods: [],
    reminderRules: [],
    reminderExecutions: [],
    policies: [],
  };
}

function user(role: "lead" | "head" | "admin" | "viewer") {
  return {
    id: USER_ID,
    email: "user@example.test",
    name: "User Example",
    lastName: "User",
    firstName: "Example",
    middleName: null,
    position: null,
    role,
    isActive: true,
  };
}

describe("adminSnapshotSchema — reporting group restore integrity", () => {
  it.each(["lead", "head", "admin"] as const)(
    "rejects a %s snapshot user without reportingGroupId",
    (role) => {
      const result = adminSnapshotSchema.safeParse(
        snapshotWithUser(user(role)),
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: ["users", 0, "reportingGroupId"],
            }),
          ]),
        );
      }
    },
  );

  it("accepts a viewer without a reporting group", () => {
    expect(
      adminSnapshotSchema.safeParse(snapshotWithUser(user("viewer"))).success,
    ).toBe(true);
  });

  it("accepts a non-viewer with an explicit reporting group", () => {
    expect(
      adminSnapshotSchema.safeParse(
        snapshotWithUser({ ...user("lead"), reportingGroupId: GROUP_ID }),
      ).success,
    ).toBe(true);
  });
});
