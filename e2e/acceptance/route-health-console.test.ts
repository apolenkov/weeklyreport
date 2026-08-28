import { describe, expect, it } from "vitest";

import { isIgnoredRouteHealthConsoleMessage } from "./route-health-console.ts";

describe("route-health console policy", () => {
  it.each([
    "The resource http://127.0.0.1:3125/_next/static/media/font-s.p.woff2?v=1 was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
    "The resource http://127.0.0.1:3125/_next/static/css/app/global-error.css?v=1 was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.",
    "Failed to load resource: favicon.ico",
  ])("ignores known framework noise: %s", (message) => {
    expect(isIgnoredRouteHealthConsoleMessage(message)).toBe(true);
  });

  it.each([
    "The resource /assets/report.css was preloaded using link preload but not used within a few seconds from the window's load event.",
    "Weekly report query failed",
    "Failed to load resource: /api/trpc/weeklyReport.get",
  ])("keeps product warnings and errors blocking: %s", (message) => {
    expect(isIgnoredRouteHealthConsoleMessage(message)).toBe(false);
  });
});
