import { describe, expect, it } from "vitest";

import { resolveCatalogRoute } from "./catalog-route.ts";

describe("catalog route resolution", () => {
  it("uses the active report for lead, head, and admin routes", () => {
    expect(resolveCatalogRoute("/lead/report/[reportId]", "lead")).toBe(
      "/lead/report/a0000000-0000-4000-8000-000000000001",
    );
  });

  it("uses the published report for viewer and shared report routes", () => {
    expect(resolveCatalogRoute("/reports/[reportId]", "viewer")).toBe(
      "/reports/a0000000-0000-4000-8000-000000000002",
    );
    expect(resolveCatalogRoute("/reports/[reportId]/present", "head")).toBe(
      "/reports/a0000000-0000-4000-8000-000000000002/present",
    );
  });

  it("passes static routes through unchanged", () => {
    expect(resolveCatalogRoute("/admin/products", "admin")).toBe(
      "/admin/products",
    );
  });

  it("fails when a dynamic route has no deterministic fixture", () => {
    expect(() =>
      resolveCatalogRoute("/lead/report/[reportId]/[sectionId]", "lead"),
    ).toThrow(/Unresolved dynamic route token/u);
  });
});
