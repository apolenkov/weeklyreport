import type { UserSession } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { groupScopeFilter, guardGroupScope } from "./group-scope.js";

const GROUP_A = "a0000000-0000-4000-8000-000000000a01";
const GROUP_B = "a0000000-0000-4000-8000-000000000a02";

function session(
  role: UserSession["role"],
  overrides: Partial<UserSession> = {},
): UserSession {
  return {
    userId: "a0000000-0000-4000-8000-000000000099",
    email: "u@x.local",
    name: "U",
    role,
    activeReportId: null,
    activeReportSectionId: null,
    reportingGroupId: GROUP_A,
    ...overrides,
  };
}

describe("groupScopeFilter", () => {
  describe("admin", () => {
    const s = session("admin");
    it.each(["user", "reportSection", "project"] as const)(
      "returns {} for %s",
      (target) => {
        expect(groupScopeFilter(s, target)).toEqual({});
      },
    );
  });

  describe("head", () => {
    const s = session("head");
    it("scopes user by own reportingGroupId", () => {
      expect(groupScopeFilter(s, "user")).toEqual({
        reportingGroupId: { in: [GROUP_A] },
      });
    });
    it("scopes reportSection by author.reportingGroupId", () => {
      expect(groupScopeFilter(s, "reportSection")).toEqual({
        author: { reportingGroupId: { in: [GROUP_A] } },
      });
    });
    it("scopes project by explicit group membership", () => {
      expect(groupScopeFilter(s, "project")).toEqual({
        groupProducts: { some: { groupId: { in: [GROUP_A] } } },
      });
    });
  });

  describe("lead", () => {
    const s = session("lead");
    it("scopes user by own reportingGroupId", () => {
      expect(groupScopeFilter(s, "user")).toEqual({
        reportingGroupId: { in: [GROUP_A] },
      });
    });
    it("scopes reportSection by author.reportingGroupId", () => {
      expect(groupScopeFilter(s, "reportSection")).toEqual({
        author: { reportingGroupId: { in: [GROUP_A] } },
      });
    });
    it("scopes project by explicit group membership", () => {
      expect(groupScopeFilter(s, "project")).toEqual({
        groupProducts: { some: { groupId: { in: [GROUP_A] } } },
      });
    });
  });

  describe("viewer", () => {
    it("scopes user by viewerGroupAccess (multi-group)", () => {
      const s = session("viewer", {
        reportingGroupId: undefined,
        viewerGroupAccess: [GROUP_A, GROUP_B],
      });
      expect(groupScopeFilter(s, "user")).toEqual({
        reportingGroupId: { in: [GROUP_A, GROUP_B] },
      });
    });
    it("scopes reportSection by author.reportingGroupId", () => {
      const s = session("viewer", {
        reportingGroupId: undefined,
        viewerGroupAccess: [GROUP_A],
      });
      expect(groupScopeFilter(s, "reportSection")).toEqual({
        author: { reportingGroupId: { in: [GROUP_A] } },
      });
    });
    it("returns zero-row filter when viewerGroupAccess is empty", () => {
      const s = session("viewer", {
        reportingGroupId: undefined,
        viewerGroupAccess: [],
      });
      expect(groupScopeFilter(s, "user")).toEqual({ id: { in: [] } });
    });
    it("returns zero-row filter when viewerGroupAccess is undefined", () => {
      const s = session("viewer", {
        reportingGroupId: undefined,
        viewerGroupAccess: undefined,
      });
      expect(groupScopeFilter(s, "reportSection")).toEqual({ id: { in: [] } });
    });
  });

  describe("head/lead with missing reportingGroupId", () => {
    it("head with no group -> zero-row filter (defensive)", () => {
      const s = session("head", { reportingGroupId: undefined });
      expect(groupScopeFilter(s, "reportSection")).toEqual({ id: { in: [] } });
    });
  });

  describe("project", () => {
    it("filters head products via explicit group membership", () => {
      const s = session("head");
      expect(groupScopeFilter(s, "project")).toEqual({
        groupProducts: { some: { groupId: { in: [GROUP_A] } } },
      });
    });

    it("filters lead products via explicit group membership", () => {
      const s = session("lead");
      expect(groupScopeFilter(s, "project")).toEqual({
        groupProducts: { some: { groupId: { in: [GROUP_A] } } },
      });
    });

    it("filters viewer products by every granted group", () => {
      const s = session("viewer", {
        reportingGroupId: undefined,
        viewerGroupAccess: [GROUP_A, GROUP_B],
      });
      expect(groupScopeFilter(s, "project")).toEqual({
        groupProducts: { some: { groupId: { in: [GROUP_A, GROUP_B] } } },
      });
    });

    it("keeps admin unrestricted", () => {
      const s = session("admin");
      expect(groupScopeFilter(s, "project")).toEqual({});
    });

    it("returns the zero-row filter for viewer with empty access", () => {
      const s = session("viewer", {
        reportingGroupId: undefined,
        viewerGroupAccess: [],
      });
      expect(groupScopeFilter(s, "project")).toEqual({ id: { in: [] } });
    });

    it("keeps user scope group-based", () => {
      const s = session("head");
      expect(groupScopeFilter(s, "user")).toEqual({
        reportingGroupId: { in: [GROUP_A] },
      });
    });

    it("keeps report section scope author-group-based", () => {
      const s = session("head");
      expect(groupScopeFilter(s, "reportSection")).toEqual({
        author: { reportingGroupId: { in: [GROUP_A] } },
      });
    });
  });
});

describe("guardGroupScope", () => {
  it.each(["head", "lead", "viewer", "admin"] as const)(
    "does not throw for a defined %s session",
    (role) => {
      expect(() => guardGroupScope(session(role))).not.toThrow();
    },
  );

  it.each([undefined, null])("throws when session is %s", (missing) => {
    expect(() => guardGroupScope(missing)).toThrow(
      "[BUG] Repository query called without a scope session",
    );
  });
});
