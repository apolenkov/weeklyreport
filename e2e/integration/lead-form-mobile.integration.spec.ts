/**
 * Mobile audit /lead/report (post-v6.0 UX-overhaul wave).
 *
 * Phase 30 (MOB-01..07) validated admin/head on mobile, but the modal-driven
 * Item/Risk/Decision/Priority flow and the click-to-apply stage popover were
 * never tested at <=390px. This spec closes that gap by:
 *
 *   1. Opening each dialog (Item / Risk / Decision / Priority) on iPhone 14
 *      and Pixel 7 viewports and asserting the dialog fits within the
 *      viewport width.
 *   2. Clicking the right-most editable stage chip and asserting the portal
 *      popover (180px wide, fixed-positioned in stage-chip.tsx) does NOT
 *      overflow off the right edge.
 *   3. Verifying primary action buttons (Save/Cancel) meet the 40px minimum
 *      touch-target the codebase already commits to (Apple HIG asks 44px;
 *      we flag but do not fail on that).
 *
 * Self-skips on chromium-integration — only ever runs on mobile-ios /
 * mobile-android.
 */

import { test, expect } from "./fixtures";
import { loginAs } from "./fixtures";
import { SEED_EMAILS } from "./helpers/seed-ids";
import type { BrowserContext, Page } from "@playwright/test";

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

async function expectDialogFitsViewport(
  page: Page,
  dialogLabelRegex: RegExp,
): Promise<void> {
  const dialog = page.getByRole("dialog", { name: dialogLabelRegex }).first();
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  const overflow = await dialog.evaluate((el, tol) => {
    const r = el.getBoundingClientRect();
    return {
      right: r.right,
      left: r.left,
      width: r.width,
      vw: window.innerWidth,
      overflowsRight: r.right > window.innerWidth + tol,
      overflowsLeft: r.left < -tol,
    };
  }, VIEWPORT_TOLERANCE_PX);

  expect(
    overflow.overflowsRight,
    `dialog right=${overflow.right} > viewport=${overflow.vw}`,
  ).toBe(false);
  expect(overflow.overflowsLeft, `dialog left=${overflow.left} < 0`).toBe(
    false,
  );
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

  test("Priority dialog fits the viewport (single field)", async ({
    browser,
  }) => {
    const { context, page } = await openLeadForm(browser);

    const addPri = page
      .getByRole("button", { name: /\+\s*Add Priority/i })
      .first();
    await expect(addPri).toBeVisible();
    await addPri.click();

    await expectDialogFitsViewport(
      page,
      /Add Priority dialog|Priority dialog/i,
    );
    await expectButtonHasMinTouchTarget(page, /^Save Priority$/i, 40);

    await context.close();
  });

  test("Stage popover does not overflow the right edge of the viewport", async ({
    browser,
  }) => {
    const { context, page } = await openLeadForm(browser);

    // Stage chips render aria-label like "<stage>: <status>". Editable
    // chips (ownership='mine') are NOT disabled; locked/unassigned chips
    // are disabled. We sort right-to-left and click the first one that
    // actually opens a popover — that's the one most likely to overflow.
    const allChips = page.locator('button[aria-label*=":"]');
    await expect(allChips.first()).toBeVisible({ timeout: 15_000 });
    const count = await allChips.count();

    type ChipInfo = { idx: number; right: number; disabled: boolean };
    const chips: ChipInfo[] = [];
    for (let i = 0; i < count; i++) {
      const info = await allChips.nth(i).evaluate((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return { right: r.right, disabled: (el as HTMLButtonElement).disabled };
      });
      chips.push({ idx: i, right: info.right, disabled: info.disabled });
    }

    // Right-to-left, editable first.
    chips.sort((a, b) => {
      if (a.disabled !== b.disabled) return a.disabled ? 1 : -1;
      return b.right - a.right;
    });

    let popoverOpened = false;
    let popoverRect: { right: number; left: number; vw: number } | null = null;
    for (const c of chips) {
      if (c.disabled) continue;
      const chip = allChips.nth(c.idx);
      await chip.scrollIntoViewIfNeeded();
      await chip.click();
      const popover = page.getByRole("menu").first();
      try {
        await expect(popover).toBeVisible({ timeout: 1_500 });
        popoverRect = await popover.evaluate((el) => {
          const r = (el as HTMLElement).getBoundingClientRect();
          return { right: r.right, left: r.left, vw: window.innerWidth };
        });
        popoverOpened = true;
        break;
      } catch {
        // Chip didn't open a popover (race / animation). Try the next one.
        continue;
      }
    }

    expect(
      popoverOpened,
      "Could not open any stage popover for this lead",
    ).toBe(true);
    if (!popoverRect) throw new Error("unreachable");

    expect(
      popoverRect.right,
      `popover right=${popoverRect.right} > viewport=${popoverRect.vw}`,
    ).toBeLessThanOrEqual(popoverRect.vw + VIEWPORT_TOLERANCE_PX);
    expect(
      popoverRect.left,
      `popover left=${popoverRect.left} < 0`,
    ).toBeGreaterThanOrEqual(-VIEWPORT_TOLERANCE_PX);

    await context.close();
  });
});
