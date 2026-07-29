/**
 * Lead journey integration tests.
 *
 * Drives login -> /lead/report -> fill -> autosave -> submit -> locked,
 * with DB-level assertions via the shared Prisma helper.
 *
 * These are mandatory product-ready scenarios. Missing controls should fail
 * the suite instead of being skipped.
 */

import type { BrowserContext, Page } from "@playwright/test";

import { expect,test } from "./fixtures";
import { loginAs } from "./fixtures";
import { prisma, resetMutations } from "./helpers/db";
import {
  ACTIVE_REPORT_ID,
  LEAD_1_ID,
  LEAD_OLGA_ID,
  LEAD_SERGEY_ID,
  PUBLISHED_REPORT_ID,
  SEED_EMAILS,
} from "./helpers/seed-ids";

test.describe("Lead journey (integration)", () => {
  test.afterEach(async () => {
    await resetMutations();
  });

  test("lead can fill items and save draft — autosave persists across reload", async ({
    browser,
  }) => {
    // Use a fresh context logged in as Olga: draft state with existing
    // editable items, so this proves dialog save -> autosave -> reload.
    const context: BrowserContext = await browser.newContext();
    const page: Page = await context.newPage();
    await loginAs(context, { role: "lead", email: SEED_EMAILS.olga });

    await page.goto("/lead/report");

    const updatedText = `Integration autosave ${Date.now()}`;

    const editItem = page.getByRole("button", { name: /^Edit$/ }).first();
    await expect(editItem).toBeVisible({ timeout: 15_000 });
    await editItem.click();

    const dialog = page.getByRole("dialog", { name: /^Edit Item dialog$/ });
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("textbox", { name: /^Description \*$/ })
      .fill(updatedText);

    await dialog.getByRole("button", { name: /^Save Item$/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(updatedText, { exact: true })).toBeVisible();

    await expect
      .poll(
        async () =>
          prisma.item.count({
            where: {
              text: updatedText,
              reportSection: {
                reportId: ACTIVE_REPORT_ID,
                authorId: LEAD_OLGA_ID,
              },
            },
          }),
        { timeout: 15_000 },
      )
      .toBe(1);

    // Persist via reload.
    await page.reload();
    await expect(page.getByText(updatedText, { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await context.close();
  });

  test("lead submit locks the form — section.status becomes submitted in DB", async ({
    browser,
  }) => {
    // Use Olga (draft, has 2 items already — minimum viable submit candidate).
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(context, { role: "lead", email: SEED_EMAILS.olga });
    await page.goto("/lead/report");

    // "Submit" (exact) is the header completion action; the fill-from split
    // button's aria-label ("Fill from most recent submitted period") and the
    // Submit-readiness panel's button (aria-label "Submit report") both also
    // match a loose /submit/i, so exact name is required for a single match.
    const submitButton = page.getByRole("button", {
      name: "Submit",
      exact: true,
    });
    await expect(submitButton).toBeVisible({ timeout: 15_000 });

    await submitButton.click();

    // Submit always opens a confirmation dialog before firing the mutation.
    const confirmDialog = page.getByRole("alertdialog", {
      name: "Confirm submission",
    });
    await expect(confirmDialog).toBeVisible({ timeout: 15_000 });
    await confirmDialog
      .getByRole("button", { name: "Submit", exact: true })
      .click();

    // Wait for the submit mutation.
    await page.waitForResponse(
      (r) =>
        r.url().includes("/trpc/") &&
        r.request().method() === "POST" &&
        /submit/i.test(r.url()),
      { timeout: 15_000 },
    );

    // DB-level truth.
    const section = await prisma.reportSection.findUnique({
      where: {
        reportId_authorId: {
          reportId: ACTIVE_REPORT_ID,
          authorId: LEAD_OLGA_ID,
        },
      },
    });
    expect(section?.status).toBe("submitted");
    expect(section?.submittedAt).not.toBeNull();

    await context.close();
  });

  test("lead can fill from previous period — items appear for empty section", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(context, { role: "lead", email: SEED_EMAILS.sergey });
    await page.goto("/lead/report");

    // The split button's icon-only main segment copies from the most recent
    // submitted period; its aria-label is the accessible name. Exact match
    // avoids ambiguity with the sibling chevron segment, whose aria-label is
    // "Choose past report to fill from" and opens the past-report picker
    // instead. Both segments live inside <FillFromButton/>.
    const fillFromBtn = page.getByRole("button", {
      name: "Fill from most recent submitted period",
      exact: true,
    });
    await expect(fillFromBtn).toBeVisible({ timeout: 15_000 });
    await fillFromBtn.click();

    // FillFromButton opens a confirmation dialog ("Replace & Fill") rather
    // than firing the mutation directly. The mutation only runs after the
    // user confirms — so the test must dismiss the dialog before
    // waitForResponse can ever match.
    const confirmFillBtn = page.getByRole("button", {
      name: "Replace & Fill",
      exact: true,
    });
    await confirmFillBtn.click();

    // Wait for the mutation that copies items.
    await page.waitForResponse(
      (r) => r.url().includes("/trpc/") && r.request().method() === "POST",
      { timeout: 15_000 },
    );

    const items = await prisma.item.count({
      where: {
        reportSection: {
          reportId: ACTIVE_REPORT_ID,
          authorId: LEAD_SERGEY_ID,
        },
      },
    });
    expect(items).toBeGreaterThan(0);

    // Sergey's published-report (Week 15) section had items per seed; verify
    // the source still exists too — proves nothing was moved instead of copied.
    const publishedItems = await prisma.item.count({
      where: {
        reportSection: {
          reportId: PUBLISHED_REPORT_ID,
          authorId: LEAD_SERGEY_ID,
        },
      },
    });
    expect(publishedItems).toBeGreaterThan(0);

    await context.close();
  });

  test("lead page renders only their own seeded section data", async ({
    leadPage,
  }) => {
    await leadPage.goto("/lead/report");

    // The seed precondition gives lead 1 exactly one active section; the UI
    // assertions below verify that other leads' data is not rendered.
    const lead1Sections = await prisma.reportSection.findMany({
      where: {
        reportId: ACTIVE_REPORT_ID,
        authorId: LEAD_1_ID,
      },
    });
    expect(lead1Sections).toHaveLength(1);

    // Heads see these names, but a lead's report must not expose them.
    const html = await leadPage.content();
    expect(html).not.toContain("Мария К.");
    expect(html).not.toContain("Игорь В.");
    expect(html).not.toContain("Дмитрий С.");
  });
});
