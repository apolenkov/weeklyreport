import { test, expect } from "@playwright/test";
import { loginByCookie, wipeAndReseed } from "./helpers/dev-auth";

const SCREENSHOT_DIR =
  ".planning/regression/screenshots/landing-role-redirect";

/**
 * LAND-RR-01..03: Role-based redirects from the landing page.
 *
 * Each test logs in via loginByCookie, navigates to /, and verifies
 * that the middleware/landing sends the session to the correct route.
 *
 * loginByCookie with no `redirect` already does a goto("/") after
 * setting the cookie; we then check the final URL with toHaveURL which
 * has built-in retry and works reliably for redirect chains.
 */

test.describe("LAND-RR-01..03: Landing role redirect", () => {
  let seeded = false;

  test.beforeEach(async ({ page }) => {
    if (!seeded) {
      // Need a valid session to call the seed endpoint.
      await loginByCookie(page, { role: "admin" });
      await wipeAndReseed(page, "advanced");
      seeded = true;
    }
  });

  /**
   * LAND-RR-01: lead session → / → /lead/report
   */
  test("LAND-RR-01: lead session → / redirects to /lead/report", async ({
    page,
  }) => {
    await loginByCookie(page, {
      role: "lead",
      email: "lead1@customreport.local",
      redirect: "/lead/report",
    });

    // The loginByCookie helper already navigated; confirm the URL with retry.
    await expect(page).toHaveURL(/\/lead\/report/, { timeout: 15_000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LAND-RR-01.png` });
  });

  /**
   * LAND-RR-02: head session → / → /head/dashboard
   */
  test("LAND-RR-02: head session → / redirects to /head/dashboard", async ({
    page,
  }) => {
    await loginByCookie(page, {
      role: "head",
      email: "head@customreport.local",
      redirect: "/head/dashboard",
    });

    await expect(page).toHaveURL(/\/head\/dashboard/, { timeout: 15_000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LAND-RR-02.png` });
  });

  /**
   * LAND-RR-03: viewer session → / → /reports?tab=published
   */
  test("LAND-RR-03: viewer session → / redirects to /reports?tab=published", async ({
    page,
  }) => {
    await loginByCookie(page, {
      role: "viewer",
      email: "viewer@customreport.local",
      redirect: "/reports?tab=published",
    });

    await expect(page).toHaveURL(/\/reports/, { timeout: 15_000 });
    await expect(page).toHaveURL(/tab=published/, { timeout: 5_000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LAND-RR-03.png` });
  });
});
