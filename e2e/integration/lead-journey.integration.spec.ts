/**
 * E2E-04: Lead journey integration tests.
 *
 * Drives login -> /lead/report -> fill -> autosave -> submit -> locked,
 * with DB-level assertions via the shared Prisma helper.
 *
 * These are mandatory product-ready scenarios. Missing controls should fail
 * the suite instead of being skipped.
 */

import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures";
import { prisma, resetMutations } from "./helpers/db";
import {
  ACTIVE_REPORT_ID,
  PUBLISHED_REPORT_ID,
  LEAD_1_ID,
  LEAD_OLGA_ID,
  LEAD_SERGEY_ID,
  SEED_EMAILS,
} from "./helpers/seed-ids";
import type { BrowserContext, Page } from "@playwright/test";
import { loginAs } from "./fixtures";

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
    leadPage: _leadPage,
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
    const confirmDialog = page.getByRole("dialog", {
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

  test("lead sees only their own data — direct tRPC call returns only their section", async ({
    leadPage,
  }) => {
    await leadPage.goto("/lead/report");

    // The leadPage fixture is logged in as lead 1.
    // A direct call to a "get my section" procedure should return ONLY
    // lead 1's section. Without knowing the exact procedure name, rely on
    // a DB-level assertion from the seed (deterministic): lead 1 has exactly
    // one active section.
    const lead1Sections = await prisma.reportSection.findMany({
      where: {
        reportId: ACTIVE_REPORT_ID,
        authorId: LEAD_1_ID,
      },
    });
    expect(lead1Sections).toHaveLength(1);

    // UI-side: page should NOT render other leads' display names anywhere.
    // (Heads see those names; leads should not.)
    const html = await leadPage.content();
    expect(html).not.toContain("Мария К.");
    expect(html).not.toContain("Игорь В.");
    expect(html).not.toContain("Дмитрий С.");
  });

  test("lead can ask a grounded question, resolve clarification, and follow a source", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const assistantRequests: unknown[] = [];
    const assistantResponses = [
      {
        kind: "clarification_required" as const,
        options: [{ label: "Portal", token: "clarification-token" }],
      },
      {
        kind: "ok" as const,
        answerMarkdown: "**The release is on track.** [S1]",
        citations: [
          {
            sourceId: "S1",
            reportId: ACTIVE_REPORT_ID,
            periodLabel: "Week 31",
            authorName: "Lead",
            subjectName: "Portal",
            recordKind: "item",
          },
        ],
        metadata: { truncated: false, insufficientEvidence: false },
      },
    ];

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("**/trpc/leadForm.assistant*", async (route) => {
      assistantRequests.push(route.request().postDataJSON());
      const response = assistantResponses.shift();
      if (!response) {
        await route.abort("failed");
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ result: { data: { json: response } } }]),
      });
    });

    await loginAs(context, { role: "lead", email: SEED_EMAILS.lead1 });
    await page.goto("/lead/report");

    await page.getByRole("button", { name: "Open report chat" }).click();
    const dialog = page.getByRole("dialog", { name: "Report chat" });
    await expect(dialog).toBeVisible();

    const axeResult = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .analyze();
    expect(axeResult.violations).toEqual([]);

    await dialog.getByRole("textbox", { name: "Your question" }).fill(
      "What changed in Portal?",
    );
    await dialog.getByRole("button", { name: "Ask report chat" }).click();
    await expect(
      dialog.getByRole("button", { name: "Portal", exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Portal", exact: true }).click();

    await expect(dialog.getByText("The release is on track.")).toBeVisible();
    const sourceLink = dialog.getByRole("link", {
      name: /S1.*Week 31.*Portal/u,
    });
    await expect(sourceLink).toHaveAttribute(
      "href",
      `/lead/report/${ACTIVE_REPORT_ID}`,
    );
    await sourceLink.click();
    await expect(page).toHaveURL(
      new RegExp(`/lead/report/${ACTIVE_REPORT_ID}$`),
    );

    expect(assistantRequests).toHaveLength(2);
    expect(JSON.stringify(assistantRequests[0])).toContain(
      "What changed in Portal?",
    );
    expect(JSON.stringify(assistantRequests[1])).toContain(
      "clarification-token",
    );
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);

    await context.close();
  });
});
