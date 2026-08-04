import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { prisma, resetMutations } from "./helpers/db";
import { performAndWaitForTrpcMutation } from "./helpers/trpc-response";

async function saveUnifiedActivityView(
  adminPage: Page,
  value: boolean,
): Promise<void> {
  await adminPage.goto("/admin/settings");
  await adminPage.getByRole("tab", { name: "Periods", exact: true }).click();
  await adminPage
    .getByRole("checkbox", { name: /Unified activity view/i })
    .setChecked(value);
  await performAndWaitForTrpcMutation(
    adminPage,
    () => adminPage.getByRole("button", { name: "Save period policy" }).click(),
    { procedure: "admin.updateSettings" },
  );
  await expect(adminPage.getByText("Period policy saved")).toBeVisible();
}

test.describe("Business-critical targeted journeys (integration)", () => {
  test.afterEach(async () => {
    await resetMutations();
  });

  test("admin period setting persists through API, DB, and reload", async ({
    adminPage,
  }) => {
    const settingsBefore = await prisma.appSettings.findUnique({
      where: { id: "singleton" },
    });
    if (!settingsBefore) {
      throw new Error("Seed app settings are missing");
    }
    const expectedValue = !settingsBefore.unifiedActivityView;

    try {
      await saveUnifiedActivityView(adminPage, expectedValue);
      const persisted = await prisma.appSettings.findUnique({
        where: { id: "singleton" },
      });
      expect(persisted?.unifiedActivityView).toBe(expectedValue);

      await adminPage.reload();
      await adminPage
        .getByRole("tab", { name: "Periods", exact: true })
        .click();
      await expect(
        adminPage.getByRole("checkbox", { name: /Unified activity view/i }),
      ).toBeChecked({ checked: expectedValue });
    } finally {
      // Restore through the product write path: direct DB reseeding does not
      // invalidate the API's live AppSettings cache.
      await saveUnifiedActivityView(
        adminPage,
        settingsBefore.unifiedActivityView,
      );
      const restored = await prisma.appSettings.findUnique({
        where: { id: "singleton" },
      });
      expect(restored?.unifiedActivityView).toBe(
        settingsBefore.unifiedActivityView,
      );
    }
  });

  test("lead switches the current report into populated slides mode", async ({
    leadPage,
  }) => {
    await leadPage.goto("/lead/report");
    const slidesLink = leadPage.getByRole("link", {
      name: "Slides",
      exact: true,
    });
    await expect(slidesLink).toBeVisible({ timeout: 15_000 });

    await Promise.all([
      leadPage.waitForURL((url) => url.searchParams.get("mode") === "slides"),
      slidesLink.click(),
    ]);

    await expect(leadPage.getByTestId("lead-slides-deck")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      leadPage.getByRole("group", {
        name: "Status slide deck (use arrow keys to navigate slides)",
      }),
    ).toBeVisible();
    await expect(leadPage.getByText("No slides available")).toHaveCount(0);
  });
});
