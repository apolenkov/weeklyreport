/**
 * Status <-> Risk coordination integration tests.
 *
 * Current product rule: changing a stage to at-risk/blocked persists the
 * project status and surfaces an "unbacked stage" warning, but does not create
 * a phantom Risk row. Creating/editing a real Risk must not double-write.
 */

import { test, expect, loginAs } from "./fixtures";
import { prisma, resetMutations } from "./helpers/db";
import {
  ACTIVE_REPORT_ID,
  LEAD_OLGA_ID,
  SEED_EMAILS,
} from "./helpers/seed-ids";
import type { BrowserContext, Page } from "@playwright/test";

async function openOlgaDraft(
  browser: import("@playwright/test").Browser,
): Promise<{
  context: BrowserContext;
  page: Page;
}> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAs(context, { role: "lead", email: SEED_EMAILS.olga });
  await page.goto("/lead/report");
  return { context, page };
}

test.describe("Status<->Risk sync (integration)", () => {
  test.afterEach(async () => {
    await resetMutations();
  });

  test("setting stage to blocked persists project status without phantom Risk row", async ({
    browser,
  }) => {
    const { context, page } = await openOlgaDraft(browser);

    const before = await prisma.risk.count({
      where: {
        reportSection: {
          reportId: ACTIVE_REPORT_ID,
          authorId: LEAD_OLGA_ID,
        },
      },
    });
    // Seed creates projectStatus rows (some may already be "red") but never
    // creates stageStatus rows, so beforeStageRed is always 0. Checking
    // stageStatus avoids a false-negative when the project's aggregate
    // status was already "red" before the test ran.
    const beforeStageRed = await prisma.stageStatus.count({
      where: {
        status: "red",
        reportSection: {
          reportId: ACTIVE_REPORT_ID,
          authorId: LEAD_OLGA_ID,
        },
      },
    });

    const editableStageChip = page
      .locator('button[aria-label*=":"]:not(:disabled)')
      .first();
    await expect(editableStageChip).toBeVisible({ timeout: 15_000 });
    await editableStageChip.click();
    await page.getByRole("menuitem", { name: /Blocked/i }).click();

    await expect
      .poll(
        async () => {
          const [stageRedCount, riskCount] = await Promise.all([
            prisma.stageStatus.count({
              where: {
                status: "red",
                reportSection: {
                  reportId: ACTIVE_REPORT_ID,
                  authorId: LEAD_OLGA_ID,
                },
              },
            }),
            prisma.risk.count({
              where: {
                reportSection: {
                  reportId: ACTIVE_REPORT_ID,
                  authorId: LEAD_OLGA_ID,
                },
              },
            }),
          ]);
          return stageRedCount > beforeStageRed && riskCount === before;
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    await context.close();
  });

  test("creating and editing a risk does not double-write", async ({
    browser,
  }) => {
    const { context, page } = await openOlgaDraft(browser);

    const before = await prisma.risk.count({
      where: {
        reportSection: {
          reportId: ACTIVE_REPORT_ID,
          authorId: LEAD_OLGA_ID,
        },
      },
    });

    await page.getByRole("button", { name: /\+\s*Add Risk/i }).click();
    await page.locator("#risk-text").fill("Integration risk text");
    await page.locator("#risk-impact").fill("Integration impact text");
    await page.locator("#risk-mitigation").fill("Integration mitigation text");
    await page.getByRole("button", { name: /^Save Risk$/ }).click();

    await expect
      .poll(
        async () =>
          prisma.risk.count({
            where: {
              reportSection: {
                reportId: ACTIVE_REPORT_ID,
                authorId: LEAD_OLGA_ID,
              },
            },
          }),
        { timeout: 15_000 },
      )
      .toBe(before + 1);

    await page
      .getByRole("button", { name: /Edit risk for/i })
      .first()
      .click();
    await page
      .locator("#risk-text")
      .fill("Updated risk text from integration test");
    await page.getByRole("button", { name: /^Save Risk$/ }).click();

    const after = await prisma.risk.count({
      where: {
        reportSection: {
          reportId: ACTIVE_REPORT_ID,
          authorId: LEAD_OLGA_ID,
        },
      },
    });
    expect(after).toBe(before + 1);

    await context.close();
  });
});
