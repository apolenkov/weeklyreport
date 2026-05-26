/**
 * Phase 39-06 (visual baseline 2/5) — Lead weekly report form.
 *
 * Uses the leadPage fixture so the page is authenticated as a seeded lead
 * (lead1@customreport.local). Captures the form with sections, traffic
 * lights, and items the lead has filled in.
 */
import { test, expect } from "../fixtures";
import { driftyMasks, freezeClock, waitForVisualStable } from "./_helpers";

test("lead report — authenticated form view", async ({ leadPage }) => {
  await freezeClock(leadPage);
  await leadPage.goto("/lead/report");
  await waitForVisualStable(leadPage);
  // Wait for the form's My Report h1 so the skeleton fallback is gone.
  // The page may client-redirect to /lead/report/<reportId> first; the
  // h1 text is identical on both URLs so this is robust.
  await leadPage
    .getByRole("heading", { name: "My Report", level: 1 })
    .waitFor({ state: "visible", timeout: 15_000 });

  await expect(leadPage).toHaveScreenshot("lead-report.png", {
    fullPage: true,
    mask: driftyMasks(leadPage),
  });
});
