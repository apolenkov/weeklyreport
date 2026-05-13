/**
 * Phase 39-06 (visual baseline 5/5) — Admin Jobs tab.
 *
 * `/admin?tab=jobs` as head — surfaces the BullMQ DLQ admin UI shipped
 * in 35-06. Captures the failed-job list shell and retry control layout.
 */
import { test, expect } from "../fixtures";
import { driftyMasks, freezeClock, waitForVisualStable } from "./_helpers";

test("admin — jobs tab as head", async ({ headPage }) => {
  await freezeClock(headPage);
  await headPage.goto("/admin?tab=jobs");
  await waitForVisualStable(headPage);

  await expect(headPage).toHaveScreenshot("admin-jobs.png", {
    fullPage: true,
    mask: driftyMasks(headPage),
  });
});
