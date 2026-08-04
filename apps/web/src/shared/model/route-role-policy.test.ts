import { describe, expect, it } from "vitest";

import {
  ADMIN_ROUTE_ROLES,
  HEAD_ROUTE_ROLES,
  LEAD_PREVIEW_ROUTE_ROLES,
  LEAD_ROUTE_ROLES,
  REPORTS_ROUTE_ROLES,
  rolesForGuardedRoute,
  VIEWER_STATUS_ROUTE_ROLES,
} from "./route-role-policy";

describe("rolesForGuardedRoute", () => {
  it.each([
    ["/admin", ADMIN_ROUTE_ROLES],
    ["/head/report/[reportId]", HEAD_ROUTE_ROLES],
    ["/lead/report", LEAD_ROUTE_ROLES],
    ["/lead/report/[reportId]/preview", LEAD_PREVIEW_ROUTE_ROLES],
    ["/reports/history", REPORTS_ROUTE_ROLES],
    ["/reports/latest", VIEWER_STATUS_ROUTE_ROLES],
  ])("returns the layout policy for %s", (route, roles) => {
    expect(rolesForGuardedRoute(route)).toEqual(roles);
  });

  it("does not manufacture roles for a public route", () => {
    expect(rolesForGuardedRoute("/login")).toBeNull();
  });
});
