import { describe, expect, it } from "vitest";

import { appRouterRouteForPage } from "./app-router-route.ts";

describe("App Router route resolution", () => {
  const appRoot = "/repo/apps/web/src/app";

  it("resolves the root page", () => {
    expect(appRouterRouteForPage(appRoot, `${appRoot}/page.tsx`)).toBe("/");
  });

  it("removes route groups without removing dynamic segments", () => {
    expect(
      appRouterRouteForPage(
        appRoot,
        `${appRoot}/(app)/lead/report/[reportId]/page.tsx`,
      ),
    ).toBe("/lead/report/[reportId]");
  });

  it("rejects non-page source files", () => {
    expect(() =>
      appRouterRouteForPage(appRoot, `${appRoot}/lead/layout.tsx`),
    ).toThrow(/Not an App Router page/u);
  });
});
