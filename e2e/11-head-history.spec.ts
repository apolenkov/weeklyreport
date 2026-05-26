/**
 * Head history redirect — /head/history 307s to /reports?tab=published.
 *
 * The full head-history page (HeadHistoryClient with period navigator,
 * archive toggle, and mode toggle) was removed in favour of the unified
 * /reports page (UAT decision 2026-05-22). Period navigation for head
 * now lives inside /head/report/[reportId] (HeadReportShell).
 */

import { test, expect } from "./fixtures";

test.describe("Head History Redirect", () => {
  test("redirects /head/history to /reports", async ({ headPage }) => {
    await headPage.goto("/head/history");
    await headPage.waitForLoadState("networkidle", { timeout: 20_000 });
    expect(headPage.url()).toContain("/reports");
  });
});
