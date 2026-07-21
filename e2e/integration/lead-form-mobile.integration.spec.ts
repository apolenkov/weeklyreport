/**
 * Mobile audit /lead/report — the modal-driven Item/Risk/Decision flow and
 * the stage-chip interaction, at <=390px (iPhone 14 / Pixel 7).
 *
 *   1. Opening each record dialog (Item, Risk, Decision — record-dialog-layout)
 *      and asserting it fits within the viewport width. Priority has no
 *      dialog of its own: it is a single "Priority rank" select field inside
 *      the Item dialog, so its test asserts that field's own bounds instead.
 *   2. Clicking the right-most editable stage chip and asserting it never
 *      opens a status menu — status-risk-unification makes a chip click a
 *      plain On Track/unset toggle, or (when a covering risk floors the
 *      chip) a no-op that surfaces a toast hint pointing at Risks &
 *      Blockers. Asserts that hint toast, when shown, fits the viewport.
 *   3. Verifying primary action buttons/fields meet the 40px minimum
 *      touch-target the codebase already commits to (Apple HIG asks 44px;
 *      we flag but do not fail on that).
 *
 * Self-skips on chromium-integration — only ever runs on mobile-ios /
 * mobile-android.
 */

import { test, expect } from "./fixtures";
import { loginAs } from "./fixtures";
import { resetMutations } from "./helpers/db";
import { SEED_EMAILS } from "./helpers/seed-ids";
import type { BrowserContext, Locator, Page } from "@playwright/test";

const VIEWPORT_TOLERANCE_PX = 1; // sub-pixel rounding

/**
 * Logs in as Olga — a draft-state lead with assigned products. lead 1
 * is "submitted" in the seed, which hides all "+ Add" buttons (the form
 * is locked once submitted), making him useless for this audit.
 */
async function openLeadForm(
  browser: import("@playwright/test").Browser,
): Promise<{
  context: BrowserContext;
  page: Page;
}> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAs(context, { role: "lead", email: SEED_EMAILS.olga });
  await page.goto("/lead/report", { waitUntil: "domcontentloaded" });
  return { context, page };
}

/** Asserts a single element's bounding box stays within the viewport width. */
async function expectElementFitsViewport(
  locator: Locator,
  label: string,
): Promise<void> {
  const overflow = await locator.evaluate((el, tol) => {
    const r = el.getBoundingClientRect();
    return {
      right: r.right,
      left: r.left,
      vw: window.innerWidth,
      overflowsRight: r.right > window.innerWidth + tol,
      overflowsLeft: r.left < -tol,
    };
  }, VIEWPORT_TOLERANCE_PX);

  expect(
    overflow.overflowsRight,
    `${label} right=${overflow.right} > viewport=${overflow.vw}`,
  ).toBe(false);
  expect(overflow.overflowsLeft, `${label} left=${overflow.left} < 0`).toBe(
    false,
  );
}

async function expectDialogFitsViewport(
  page: Page,
  dialogLabelRegex: RegExp,
): Promise<void> {
  const dialog = page.getByRole("dialog", { name: dialogLabelRegex }).first();
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await expectElementFitsViewport(dialog, "dialog");
}

async function expectButtonHasMinTouchTarget(
  page: Page,
  nameRegex: RegExp,
  minHeight: number,
): Promise<void> {
  const btn = page.getByRole("button", { name: nameRegex }).last();
  await expect(btn).toBeVisible();
  const h = await btn.evaluate(
    (el) => (el as HTMLElement).getBoundingClientRect().height,
  );
  expect(
    h,
    `button "${nameRegex}" height=${h} < ${minHeight}`,
  ).toBeGreaterThanOrEqual(minHeight);
}

test.describe("Mobile — /lead/report modal flow @MOB-AUDIT", () => {
  test.beforeEach(async ({}, testInfo) => {
    expect(testInfo.project.name).not.toBe("chromium-integration");
  });

  test("Item dialog fits the viewport and primary action is a 40px target", async ({
    browser,
  }) => {
    const { context, page } = await openLeadForm(browser);

    // The Add buttons live in current-week-section; per-product they read
    // "+ Add" with aria-label "Add item to <product>". Empty-state shows
    // "+ Add Item" with aria-label "Add first current-week item". Match
    // both via aria-label so this test works whether the lead has items
    // already or starts from empty.
    const addItem = page
      .getByRole("button", {
        name: /(Add item to |Add first current-week item)/i,
      })
      .first();
    await expect(addItem).toBeVisible({ timeout: 15_000 });
    await addItem.click();

    await expectDialogFitsViewport(page, /Add Item dialog|Item dialog/i);
    await expectButtonHasMinTouchTarget(page, /^Save Item$/i, 40);

    await context.close();
  });

  test("Risk dialog fits the viewport (3 textareas — tightest layout)", async ({
    browser,
  }) => {
    const { context, page } = await openLeadForm(browser);

    const addRisk = page
      .getByRole("button", { name: /\+\s*Add Risk/i })
      .first();
    await expect(addRisk).toBeVisible();
    await addRisk.click();

    await expectDialogFitsViewport(page, /Add Risk dialog|Risk dialog/i);
    await expectButtonHasMinTouchTarget(page, /^Save Risk$/i, 40);

    await context.close();
  });

  test("Decision dialog fits the viewport (sm:grid-cols-2 stack)", async ({
    browser,
  }) => {
    const { context, page } = await openLeadForm(browser);

    const addDec = page
      .getByRole("button", { name: /\+\s*Add Decision/i })
      .first();
    await expect(addDec).toBeVisible();
    await addDec.click();

    await expectDialogFitsViewport(
      page,
      /Add Decision dialog|Decision dialog/i,
    );
    await expectButtonHasMinTouchTarget(page, /^Save Decision$/i, 40);

    await context.close();
  });

  test("Priority rank field fits the viewport (single field inside the Item dialog)", async ({
    browser,
  }) => {
    const { context, page } = await openLeadForm(browser);

    // record-dialog-layout: priority is not a dialog of its own — it's the
    // "Priority rank" select on the left column of the Item dialog, under
    // Description (item-edit-dialog-fields.tsx). Open the Item dialog the
    // same way the Item-dialog test does, then assert the field itself.
    const addItem = page
      .getByRole("button", {
        name: /(Add item to |Add first current-week item)/i,
      })
      .first();
    await expect(addItem).toBeVisible({ timeout: 15_000 });
    await addItem.click();

    await expectDialogFitsViewport(page, /Add Item dialog|Item dialog/i);

    const priorityField = page.getByLabel(/Priority rank/i);
    await expect(priorityField).toBeVisible();
    await expectElementFitsViewport(priorityField, "priority rank field");

    const fieldHeight = await priorityField.evaluate(
      (el) => el.getBoundingClientRect().height,
    );
    expect(
      fieldHeight,
      `priority rank field height=${fieldHeight} < 40`,
    ).toBeGreaterThanOrEqual(40);

    await context.close();
  });

  test("Clicking the right-most editable stage chip opens no popover and stays within the viewport", async ({
    browser,
  }) => {
    const { context, page } = await openLeadForm(browser);
    let mutatedDraft = false;

    try {
      // Stage chips render aria-label like "<stage>: <status>[ — status
      // set| by risk]". Editable chips (ownership='mine') carry
      // aria-disabled="false"; locked/foreign chips carry aria-disabled="true"
      // (status-risk-unification — there's no other disabled signal any
      // more). We target the right-most editable chip: the one most likely
      // to have any floating UI clipped by a narrow viewport.
      const allChips = page.locator('button[aria-label*=":"]');
      await expect(allChips.first()).toBeVisible({ timeout: 15_000 });
      const count = await allChips.count();

      type ChipInfo = {
        idx: number;
        right: number;
        editable: boolean;
        label: string;
      };
      const chips: ChipInfo[] = [];
      for (let i = 0; i < count; i++) {
        const info = await allChips.nth(i).evaluate((el) => {
          const r = el.getBoundingClientRect();
          return {
            right: r.right,
            editable: el.getAttribute("aria-disabled") !== "true",
            label: el.getAttribute("aria-label") ?? "",
          };
        });
        chips.push({ idx: i, ...info });
      }

      const editableChips = chips.filter((c) => c.editable);
      expect(
        editableChips.length,
        "Expected at least one editable stage chip for this lead",
      ).toBeGreaterThan(0);
      editableChips.sort((a, b) => b.right - a.right);
      const target = editableChips[0];
      const chip = allChips.nth(target.idx);

      await chip.scrollIntoViewIfNeeded();
      // A chip covered by a risk carries the " by risk" suffix (see
      // stage-chip.tsx); clicking it is a no-op that only surfaces a hint.
      const wasCovered = /by risk/i.test(target.label);
      await chip.click();

      // A chip click NEVER opens a status menu — it's a plain toggle, or (if
      // covered) a no-op redirect to Risks & Blockers.
      await expect(page.getByRole("menu")).toHaveCount(0);

      if (wasCovered) {
        const hint = page.getByText(
          /Resolve it in Risks & Blockers to change the stage/i,
        );
        await expect(hint).toBeVisible({ timeout: 5_000 });
        await expectElementFitsViewport(hint, "covering-risk hint toast");
      } else {
        // toBeVisible + auto-retrying attribute assertion — the toggle's
        // setState re-render need not have flushed the instant .click()
        // resolves.
        await expect(
          chip,
          "Clicking an uncovered editable chip should toggle its status",
        ).not.toHaveAttribute("aria-label", target.label);
        mutatedDraft = true;
        await expectElementFitsViewport(chip, "stage chip");
      }
    } finally {
      if (mutatedDraft) {
        // Restore the seeded baseline — the toggle click above autosaves the
        // draft, and this suite runs single-worker against a shared seed.
        await resetMutations();
      }
      await context.close();
    }
  });
});
