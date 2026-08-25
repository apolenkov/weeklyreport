import { describe, expect, it } from "vitest";

import {
  type PreflightRoute,
  revealRouteFor,
} from "./playwright-preflight-support.ts";

const route: PreflightRoute = {
  role: "admin",
  catalogRoute: "/admin/activities",
  resolvedRoute: "/admin/activities",
  landingRoute: "/admin?tab=activities",
  target: "none",
};

describe("playwright preflight route binding", () => {
  it("keeps entry navigation and reveal landing routes distinct", () => {
    expect(route.resolvedRoute).toBe("/admin/activities");
    expect(revealRouteFor(route)).toMatchObject({
      resolvedRoute: "/admin?tab=activities",
      landingRoute: "/admin?tab=activities",
    });
  });
});
