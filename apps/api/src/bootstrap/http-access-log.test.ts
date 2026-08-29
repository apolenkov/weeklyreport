import { describe, expect, it } from "vitest";

import {
  ADMIN_QUEUES_ROUTE,
  CLIENT_LOGS_ROUTE,
  normalizeHttpRoute,
  PDF_DOWNLOAD_ROUTE,
  UNKNOWN_HTTP_ROUTE,
} from "./http-access-log.js";

describe("normalizeHttpRoute", () => {
  it.each([
    ["/health", "/health"],
    ["/health/live", "/health/live"],
    ["/health/ready", "/health/ready"],
    ["/health/arbitrary", "/health/*"],
    ["/auth/saml/callback", "/auth/*"],
    ["/pdfs/report-secret.pdf", PDF_DOWNLOAD_ROUTE],
    ["/admin/queues", ADMIN_QUEUES_ROUTE],
    ["/admin/queues/api/jobs/123", ADMIN_QUEUES_ROUTE],
    [CLIENT_LOGS_ROUTE, CLIENT_LOGS_ROUTE],
    ["/metrics", "/metrics"],
  ])("maps %s to the bounded route label %s", (path, expected) => {
    expect(normalizeHttpRoute(path)).toBe(expected);
  });

  it("collapses arbitrary non-UUID paths to one bounded fallback", () => {
    const routes = new Set(
      Array.from({ length: 100 }, (_, index) =>
        normalizeHttpRoute(`/attacker-controlled/${String(index)}`),
      ),
    );

    expect(routes).toEqual(new Set([UNKNOWN_HTTP_ROUTE]));
  });
});
