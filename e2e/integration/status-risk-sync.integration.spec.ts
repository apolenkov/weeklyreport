/**
 * Status <-> Risk coordination integration tests.
 *
 * A stage chip has no status menu and cannot author at-risk/blocked at all —
 * it is a plain toggle between unset and On Track. At-risk/blocked are authored only as
 * Risk rows in the Risks & Blockers section; a covering risk floors the
 * chip's displayed severity at render time without writing anything onto the
 * stage itself. Toggling a chip must never create a phantom Risk row, and
 * creating/editing a real Risk must not double-write.
 */

import type { BrowserContext, Page } from "@playwright/test";

import { expect, loginAs,test } from "./fixtures";
import { prisma, resetMutations } from "./helpers/db";
import {
  ACTIVE_REPORT_ID,
  LEAD_OLGA_ID,
  SEED_EMAILS,
} from "./helpers/seed-ids";

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

  test("toggling an uncovered stage chip persists the change without creating a phantom Risk row", async ({
    browser,
  }) => {
    const { context, page } = await openOlgaDraft(browser);

    const riskBefore = await prisma.risk.count({
      where: {
        reportSection: {
          reportId: ACTIVE_REPORT_ID,
          authorId: LEAD_OLGA_ID,
        },
      },
    });
    // Count of Olga's owned stages with an EXPLICIT (non-null) status,
    // regardless of color. This is the migration-agnostic invariant to poll:
    // any autosave collapses a stale unbacked at-risk/blocked reading down to
    // green, which would make a `status: "green"` count drift for reasons
    // unrelated to this test's own click.
    // Collapsing null<->non-null never happens on its own, so this total
    // only moves by the toggle this test performs.
    const explicitStatusBefore = await prisma.stageStatus.count({
      where: {
        status: { not: null },
        reportSection: {
          reportId: ACTIVE_REPORT_ID,
          authorId: LEAD_OLGA_ID,
        },
      },
    });

    // The chip is a plain On Track<->unset toggle. An editable, uncovered chip's
    // aria-label ends in "status set"; an unset chip ends in ": empty", and
    // a chip floored by a covering risk instead ends in "by risk" and ignores
    // the click, so this selector
    // reaches only a chip the click can actually change. Capture its product
    // and stage identity, then use those stable values to re-resolve the same
    // chip after each React render.
    const initiallySetChip = page
      .locator('button[aria-label$="status set"]')
      .first();
    await expect(initiallySetChip).toBeVisible({ timeout: 15_000 });
    const initialLabel = await initiallySetChip.getAttribute("aria-label");
    if (!initialLabel) throw new Error("Stage chip has no accessible label");
    const stageName = initialLabel.slice(0, initialLabel.indexOf(":"));
    const productName = await initiallySetChip.evaluate((button) =>
      button
        .closest(".rounded-xl")
        ?.querySelector("span.font-semibold")
        ?.textContent.trim(),
    );
    if (!productName) throw new Error("Stage chip has no product container");
    const productCard = page.locator("div.rounded-xl").filter({
      has: page.getByText(productName, { exact: true }),
    });
    const escapedStageName = stageName.replaceAll(
      /[.*+?^${}()|[\]\\]/g,
      String.raw`\$&`,
    );
    const chip = productCard.getByRole("button", {
      name: new RegExp(`^${escapedStageName}:`),
    });

    await chip.click(); // on-track -> unset (empty)
    await expect(chip).toHaveAttribute("aria-label", /: empty$/);

    await expect
      .poll(
        async () => {
          const [explicitStatusCount, riskCount] = await Promise.all([
            prisma.stageStatus.count({
              where: {
                status: { not: null },
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
          return (
            explicitStatusCount === explicitStatusBefore - 1 &&
            riskCount === riskBefore
          );
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    // Restore: click again (empty -> on-track) so the draft's persisted
    // state is unchanged for any test that runs after this one.
    await chip.click();
    await expect(chip).toHaveAttribute("aria-label", initialLabel);

    await expect
      .poll(
        async () => {
          const [explicitStatusCount, riskCount] = await Promise.all([
            prisma.stageStatus.count({
              where: {
                status: { not: null },
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
          return (
            explicitStatusCount === explicitStatusBefore &&
            riskCount === riskBefore
          );
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

    // require-risk-stage: a product risk needs >=1 owned stage. Stage
    // checkboxes start unchecked on create (StageMultiSelect renders a
    // checkbox group only when the lead owns >=2 stages on the seeded
    // default product; a single owned stage is applied automatically and
    // shows no checkbox at all), so check one explicitly when present.
    const stageCheckboxes = page.locator(
      '[data-testid="stage-checkbox-group"] input[type="checkbox"]',
    );
    if ((await stageCheckboxes.count()) > 0) {
      await stageCheckboxes.first().check();
    }

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
    const editSaveResponse = page.waitForResponse(
      (response) =>
        response.url().includes("reports.saveDraft") &&
        response.request().method() === "POST",
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: /^Save Risk$/ }).click();
    await editSaveResponse;

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
