import type { Role } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { isRouteVisible, ROUTE_ROLE_MAP } from "./role-visibility";

interface Case {
  route: string;
  role: Role;
  expected: boolean;
}

const cases: readonly Case[] = [
  // viewer
  { route: "/admin", role: "viewer", expected: false },
  { route: "/head/dashboard", role: "viewer", expected: false },
  { route: "/lead/report", role: "viewer", expected: false },
  { route: "/reports/history", role: "viewer", expected: true },
  { route: "/reports", role: "viewer", expected: true },
  // lead
  { route: "/admin", role: "lead", expected: false },
  { route: "/head/dashboard", role: "lead", expected: false },
  { route: "/lead/report", role: "lead", expected: true },
  { route: "/lead/history", role: "lead", expected: true },
  { route: "/reports/history", role: "lead", expected: true },
  // head — admin segment is admin-only; head has no /admin
  { route: "/admin", role: "head", expected: false },
  { route: "/head/dashboard", role: "head", expected: true },
  { route: "/head/report", role: "head", expected: true },
  { route: "/lead/report", role: "head", expected: true },
  { route: "/reports/history", role: "head", expected: true },
  // admin
  { route: "/admin", role: "admin", expected: true },
  { route: "/head/dashboard", role: "admin", expected: true },
  { route: "/lead/report", role: "admin", expected: true },
  { route: "/reports/history", role: "admin", expected: true },
];

describe("isRouteVisible — role × route matrix", () => {
  for (const c of cases) {
    it(`role=${c.role} sees ${c.route} → ${c.expected}`, () => {
      expect(isRouteVisible(c.route, c.role)).toBe(c.expected);
    });
  }

  it("unmapped routes are visible to all authenticated roles by default", () => {
    expect(isRouteVisible("/auth/login", "viewer")).toBe(true);
    expect(isRouteVisible("/something-else", "viewer")).toBe(true);
    expect(isRouteVisible("/profile", "lead")).toBe(true);
  });

  it('exact-prefix match: "/admin" matches the /admin prefix', () => {
    expect(isRouteVisible("/admin", "viewer")).toBe(false);
    expect(isRouteVisible("/admin", "admin")).toBe(true);
  });

  it("substring-but-not-prefix routes do NOT match (no false positives)", () => {
    // '/administrator' is not a /admin/* path — should hit the unmapped branch
    expect(isRouteVisible("/administrator", "viewer")).toBe(true);
  });

  it("ROUTE_ROLE_MAP shape is the source of truth for the four route segments", () => {
    expect(Object.keys(ROUTE_ROLE_MAP).sort()).toEqual([
      "/admin",
      "/head",
      "/lead",
      "/reports",
    ]);
  });
});
