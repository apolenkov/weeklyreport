import type { UserSession } from "@customreport/shared";
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
    it("returns {} for user", () => {
      expect(groupScopeFilter(s, "user")).toEqual({});
    });
    it("returns {} for reportSection", () => {
      expect(groupScopeFilter(s, "reportSection")).toEqual({});
    });
    it("returns {} for project", () => {
      expect(groupScopeFilter(s, "project")).toEqual({});
    });
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
    it("scopes project by lead.reportingGroupId", () => {
      expect(groupScopeFilter(s, "project")).toEqual({
        lead: { reportingGroupId: { in: [GROUP_A] } },
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
    it("scopes project by lead.reportingGroupId", () => {
      expect(groupScopeFilter(s, "project")).toEqual({
        lead: { reportingGroupId: { in: [GROUP_A] } },
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

  describe("head/lead with missing reportingGroupId (legacy JWT)", () => {
    it("head with no group -> zero-row filter (defensive)", () => {
      const s = session("head", { reportingGroupId: undefined });
      expect(groupScopeFilter(s, "reportSection")).toEqual({ id: { in: [] } });
    });
  });

  // -------------------------------------------------------------------
  // useExplicitGroupProducts opt-in flag
  //
  // Default OFF keeps the bit-for-bit legacy behaviour (the four cases
  // above already cover that path). The ON path swaps the Project
  // fragment to the GroupProduct join. All other targets ignore the
  // flag — only `project` is affected by the M:M edge.
  // -------------------------------------------------------------------

  describe("useExplicitGroupProducts", () => {
    it("legacy path: omitting options returns lead.reportingGroupId.in", () => {
      const s = session("head");
      expect(groupScopeFilter(s, "project")).toEqual({
        lead: { reportingGroupId: { in: [GROUP_A] } },
      });
    });

    it("flag = false: explicit-off matches the legacy path", () => {
      const s = session("head");
      expect(
        groupScopeFilter(s, "project", { useExplicitGroupProducts: false }),
      ).toEqual({ lead: { reportingGroupId: { in: [GROUP_A] } } });
    });

    it("flag = true (head): filters via groupProducts.some.groupId.in", () => {
      const s = session("head");
      expect(
        groupScopeFilter(s, "project", { useExplicitGroupProducts: true }),
      ).toEqual({ groupProducts: { some: { groupId: { in: [GROUP_A] } } } });
    });

    it("flag = true (lead): same M:M fragment as head", () => {
      const s = session("lead");
      expect(
        groupScopeFilter(s, "project", { useExplicitGroupProducts: true }),
      ).toEqual({ groupProducts: { some: { groupId: { in: [GROUP_A] } } } });
    });

    it("flag = true (viewer multi-group): groupId.in includes all viewer groups", () => {
      const s = session("viewer", {
        reportingGroupId: undefined,
        viewerGroupAccess: [GROUP_A, GROUP_B],
      });
      expect(
        groupScopeFilter(s, "project", { useExplicitGroupProducts: true }),
      ).toEqual({
        groupProducts: { some: { groupId: { in: [GROUP_A, GROUP_B] } } },
      });
    });

    it("flag = true (admin): still returns {} (god-mode wins)", () => {
      const s = session("admin");
      expect(
        groupScopeFilter(s, "project", { useExplicitGroupProducts: true }),
      ).toEqual({});
    });

    it("flag = true (viewer with empty access): still returns the zero-row filter", () => {
      const s = session("viewer", {
        reportingGroupId: undefined,
        viewerGroupAccess: [],
      });
      expect(
        groupScopeFilter(s, "project", { useExplicitGroupProducts: true }),
      ).toEqual({ id: { in: [] } });
    });

    it("flag does not affect non-project targets (user)", () => {
      const s = session("head");
      expect(
        groupScopeFilter(s, "user", { useExplicitGroupProducts: true }),
      ).toEqual({ reportingGroupId: { in: [GROUP_A] } });
    });

    it("flag does not affect non-project targets (reportSection)", () => {
      const s = session("head");
      expect(
        groupScopeFilter(s, "reportSection", {
          useExplicitGroupProducts: true,
        }),
      ).toEqual({ author: { reportingGroupId: { in: [GROUP_A] } } });
    });
  });
});

describe("guardGroupScope", () => {
  it("does not throw when session is defined", () => {
    expect(() => guardGroupScope(session("head"))).not.toThrow();
  });

  it("does not throw for admin session", () => {
    expect(() => guardGroupScope(session("admin"))).not.toThrow();
  });

  it("throws when session is undefined", () => {
    expect(() => guardGroupScope(undefined)).toThrow(
      "[BUG] Repository query called without a scope session",
    );
  });
});
