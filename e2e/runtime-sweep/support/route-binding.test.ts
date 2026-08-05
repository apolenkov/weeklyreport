import { describe, expect, it } from "vitest";

import {
  ACTIVE_REPORT_ID,
  PUBLISHED_REPORT_ID,
} from "../../../prisma/seeds/support/seed-constants.ts";
import type { CatalogRoute } from "../../sweep/catalog-parser.ts";
import {
  bindCatalogRoute,
  bindingForProfileOrThrow,
  routeDeclarationFromCatalog,
} from "./route-binding.ts";

const route = (
  value: string,
  role: CatalogRoute["access"][number] = "viewer",
  note = "",
): CatalogRoute => ({
  route: value,
  access: [role],
  intents: [
    {
      id: "fixture",
      intent: "Fixture route",
      given: "Fixture state",
      when: "The route is opened",
      then: "The route renders",
      note,
    },
  ],
});

describe("runtime route binding", () => {
  it("assigns every published-capable profile for archive report routes", () => {
    const binding = bindCatalogRoute(
      route("/reports/[reportId]", "head"),
      "head",
    );

    expect(binding.target).toBe("published");
    expect(binding.requiredCapability).toBe("published-period");
    expect(binding.minimumProfile).toBe("demo");
    expect(binding.resolvedRoute).toBe(`/reports/${PUBLISHED_REPORT_ID}`);
    expect(binding.bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "not-applicable",
          profile: "minimal",
          resolvedRoute: `/reports/${PUBLISHED_REPORT_ID}`,
        }),
        expect.objectContaining({ status: "assigned", profile: "demo" }),
        expect.objectContaining({ status: "assigned", profile: "full" }),
        expect.objectContaining({ status: "assigned", profile: "stress" }),
      ]),
    );
    expect(() => bindingForProfileOrThrow(binding, "minimal")).toThrow(
      "does not declare required capability published-period",
    );
  });

  it("binds viewer live status only to profiles with visible submitted content", () => {
    const catalog = route(
      "/reports/[reportId]",
      "viewer",
      "viewer-live-status: current editable period live",
    );
    const binding = bindCatalogRoute(catalog, "viewer");

    expect(binding.target).toBe("active");
    expect(binding.requiredCapability).toBe("submission-contrast");
    expect(binding.minimumProfile).toBe("demo");
    expect(binding.resolvedRoute).toBe(`/reports/${ACTIVE_REPORT_ID}`);
    expect(binding.bindings[0]).toMatchObject({
      status: "not-applicable",
      profile: "minimal",
      target: "active",
    });
    expect(binding.bindings.slice(1)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "assigned", profile: "demo" }),
        expect.objectContaining({ status: "assigned", profile: "full" }),
        expect.objectContaining({ status: "assigned", profile: "stress" }),
      ]),
    );
  });

  it("keeps a viewer published route on the published id when the oracle is silent", () => {
    const binding = bindCatalogRoute(route("/reports/[reportId]"), "viewer");

    expect(binding.target).toBe("published");
    expect(binding.resolvedRoute).toBe(`/reports/${PUBLISHED_REPORT_ID}`);
    expect(binding.minimumProfile).toBe("demo");
  });

  it("writes the same typed bindings that the manifest consumes", () => {
    const declaration = routeDeclarationFromCatalog(
      route("/head/report/[reportId]", "head"),
      "head",
    );

    expect(declaration.bindings).toHaveLength(4);
    expect(declaration.resolvedRoute).toBe(`/head/report/${ACTIVE_REPORT_ID}`);
    expect(declaration.bindings?.map(({ profile }) => profile)).toEqual([
      "minimal",
      "demo",
      "full",
      "stress",
    ]);
  });
});
