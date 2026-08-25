import type { Response } from "@playwright/test";
import { describe, expect, it } from "vitest";

import {
  navigateToResolverRequest,
  REPORTS_LATEST,
} from "./resolver-navigation.ts";

describe("viewer status resolver navigation", () => {
  it("returns from redirected detail to reports/latest before awaiting the resolver request", async () => {
    let currentPath = "/reports/active-report?source=status&recovery=0";
    const events: string[] = [];
    const resolverResponse = {
      url: () => "/trpc/reports.latestForViewer?batch=1",
    };
    const page = {
      goto: (target: string) => {
        expect(currentPath).toContain("/reports/active-report");
        events.push(`goto:${target}`);
        currentPath = target;
        return Promise.resolve(null);
      },
    } as unknown as import("@playwright/test").Page;

    const response = await navigateToResolverRequest(
      page,
      Promise.resolve(resolverResponse as unknown as Response),
    );

    expect(events).toEqual([`goto:${REPORTS_LATEST}`]);
    expect(currentPath).toBe(REPORTS_LATEST);
    expect(response.url()).toContain("reports.latestForViewer");
  });
});
