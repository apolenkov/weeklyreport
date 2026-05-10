import { describe, expect, it } from "vitest";
import type { UserSession } from "@customreport/shared";

import { groupScopeFilter } from "./group-scope.js";

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
});
