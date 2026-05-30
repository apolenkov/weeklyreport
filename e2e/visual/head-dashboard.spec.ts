/**
 * Phase 39-06 (visual baseline 3/5) — Head dashboard.
 *
 * Uses headPage fixture (head@customreport.local). The dashboard renders
 * the traffic-light overview and the activity-live panel — both of which
 * are time-sensitive, so determinism matters here most.
 */
import { test, expect } from "../fixtures";
import { driftyMasks, freezeClock, waitForVisualStable } from "./_helpers";

test("head dashboard — assembled portfolio view", async ({ headPage }) => {
  await freezeClock(headPage);
  await headPage.goto("/head/dashboard");
  await waitForVisualStable(headPage);
  // Dashboard heading appears once tRPC initial queries resolve.
  await headPage
    .getByRole("heading", { level: 1 })
    .first()
    .waitFor({ state: "visible", timeout: 15_000 });

  await expect(headPage).toHaveScreenshot("head-dashboard.png", {
    fullPage: true,
    mask: driftyMasks(headPage),
  });
});
