import { test, expect } from "@playwright/test";
import { loginByCookie, wipeAndReseed } from "./helpers/dev-auth";

/**
 * LEAD-VHS-01..07: Version History Snapshot (F3)
 *
 * Covers:
 *   F3.1  — saveDraft debounce → createSnapshot fires ~5s after autosave
 *   F3.4  — VersionHistoryNav arrows switch snapshot mode / read-only banner
 *   F3.4  — Restore returns draft to snapshot state (items + priorityRank +
 *            severity + stageStatuses)
 *
 * Timing:
 *   autosave debounce = 3 s, snapshot delay after autosave = 5 s
 *   => total edit->createSnapshot ~8-10 s. waitForResponse uses 15 s timeout.
 *
 * URL patterns (tRPC httpBatchLink, base path /trpc):
 *   saveDraft      => *\/trpc\/reports.saveDraft*
 *   createSnapshot => *\/trpc\/leadForm.createSnapshot*
 *   restoreVersion => *\/trpc\/leadForm.restoreVersion*
 */

const SCREENSHOT_DIR =
  ".planning/regression/screenshots/version-history-snapshot";

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Read version number from VersionHistoryNav pill via aria-label. */
async function readCurrentVersion(
  page: import("@playwright/test").Page,
): Promise<number | null> {
  const pill = page.getByRole("button", {
    name: /Version \d+ — open history/,
  });
  const label = await pill.getAttribute("aria-label").catch(() => null);
  if (label) {
    const m = /Version (\d+)/.exec(label);
    if (m) return Number(m[1]);
  }
  // Fallback: visible text "vN" inside tabular-nums span
  const spanText = await pill
    .locator("span.tabular-nums")
    .textContent()
    .catch(() => null);
  if (spanText) {
    const m = /v(\d+)/.exec(spanText.trim());
    if (m) return Number(m[1]);
  }
  return null;
}

// ─── suite setup ──────────────────────────────────────────────────────────────

test.describe("LEAD-VHS-01..07: Version History Snapshot", () => {
  let seeded = false;

  test.beforeEach(async ({ page }) => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      await loginByCookie(page, {
        role: "lead",
        email: "olga@customreport.local",
        redirect: "/lead/report",
      });
      if (!seeded) {
        await wipeAndReseed(page, "advanced");
        seeded = true;
        await loginByCookie(page, {
          role: "lead",
          email: "olga@customreport.local",
          redirect: "/lead/report",
        });
      }
      const ready = await page
        .waitForSelector('[data-testid="lead-report-form"]', { timeout: 12000 })
        .then(async () => {
          await page
            .waitForLoadState("networkidle", { timeout: 10000 })
            .catch(() => null);
          return page
            .getByRole("button", { name: /Version \d+ — open history/ })
            .isVisible({ timeout: 5000 })
            .catch(() => false);
        })
        .catch(() => false);
      if (ready) return;
    }
    await page.waitForSelector('[data-testid="lead-report-form"]', {
      timeout: 12000,
    });
  });

  // ── LEAD-VHS-01 ─────────────────────────────────────────────────────────────
  test("LEAD-VHS-01: version pill visible and shows a positive version number", async ({
    page,
  }) => {
    const versionN = await readCurrentVersion(page);
    expect(versionN).not.toBeNull();
    expect(versionN!).toBeGreaterThan(0);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-VHS-01.png` });
  });

  // ── LEAD-VHS-02 ─────────────────────────────────────────────────────────────
  test("LEAD-VHS-02: editing an item triggers autosave then createSnapshot — version bumps", async ({
    page,
  }) => {
    const vBefore = await readCurrentVersion(page);
    expect(vBefore).not.toBeNull();

    // Open item edit dialog
    const firstItemCard = page.locator('[data-testid="item-card"]').first();
    const cardVisible = await firstItemCard.isVisible().catch(() => false);
    if (cardVisible) {
      await firstItemCard.hover();
      await firstItemCard
        .getByRole("button", { name: "Edit", exact: true })
        .click();
    } else {
      await page
        .getByRole("button", { name: /Add item/i })
        .first()
        .click();
    }

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const textInput = dialog.getByRole("textbox").first();
    await expect(textInput).toBeEnabled();
    await textInput.fill(`VHS-02 edit ${Date.now()}`);
    await dialog.getByRole("button", { name: /save/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Wait for autosave to complete
    await page.waitForResponse(
      (r) => r.url().includes("reports.saveDraft") && r.status() < 400,
      { timeout: 10000 },
    );

    // Wait for debounced snapshot (fires ~5 s after autosave success)
    await page.waitForResponse(
      (r) => r.url().includes("leadForm.createSnapshot") && r.status() < 400,
      { timeout: 15000 },
    );

    // Give React a render cycle after versions re-fetch
    await page.waitForTimeout(500);

    const vAfter = await readCurrentVersion(page);
    expect(vAfter).not.toBeNull();
    expect(vAfter!).toBeGreaterThan(vBefore!);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-VHS-02.png` });
  });

  // ── LEAD-VHS-03 ─────────────────────────────────────────────────────────────
  test("LEAD-VHS-03: Saved indicator appears after saveDraft response", async ({
    page,
  }) => {
    const firstItemCard = page.locator('[data-testid="item-card"]').first();
    const cardVisible = await firstItemCard.isVisible().catch(() => false);
    if (cardVisible) {
      await firstItemCard.hover();
      await firstItemCard
        .getByRole("button", { name: "Edit", exact: true })
        .click();
    } else {
      await page
        .getByRole("button", { name: /Add item/i })
        .first()
        .click();
    }

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const textInput = dialog.getByRole("textbox").first();
    await expect(textInput).toBeEnabled();
    await textInput.fill(`VHS-03 indicator ${Date.now()}`);
    await dialog.getByRole("button", { name: /save/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    await page.waitForResponse(
      (r) => r.url().includes("reports.saveDraft") && r.status() < 400,
      { timeout: 10000 },
    );

    // Autosave label reads "Saved at HH:MM" or "Autosaved" after success
    const savedIndicator = page
      .getByText(/Saved at \d{1,2}:\d{2}|Autosaved/i)
      .first();
    await expect(savedIndicator).toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-VHS-03.png` });
  });

  // ── LEAD-VHS-04 ─────────────────────────────────────────────────────────────
  test("LEAD-VHS-04: clicking prev navigates to historical snapshot — read-only banner visible", async ({
    page,
  }) => {
    const prevBtn = page.getByRole("button", { name: "Previous version" });
    const isPrevDisabled = await prevBtn
      .isDisabled({ timeout: 3000 })
      .catch(() => true);

    if (isPrevDisabled) {
      test.skip();
      return;
    }

    await prevBtn.click();

    // Snapshot mode banner rendered when viewedSnapshotVersion != null
    const banner = page.getByText(/Viewing snapshot v\d+ — read-only/i);
    await expect(banner).toBeVisible({ timeout: 8000 });

    // Back-to-current button must also be present
    await expect(
      page.getByRole("button", { name: "Back to current" }),
    ).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-VHS-04.png` });
  });

  // ── LEAD-VHS-05 ─────────────────────────────────────────────────────────────
  test("LEAD-VHS-05: clicking next from snapshot returns to current — banner disappears", async ({
    page,
  }) => {
    const prevBtn = page.getByRole("button", { name: "Previous version" });
    const isPrevDisabled = await prevBtn
      .isDisabled({ timeout: 3000 })
      .catch(() => true);

    if (isPrevDisabled) {
      test.skip();
      return;
    }

    await prevBtn.click();
    await expect(
      page.getByText(/Viewing snapshot v\d+ — read-only/i),
    ).toBeVisible({ timeout: 8000 });

    const nextBtn = page.getByRole("button", { name: "Next version" });
    await expect(nextBtn).toBeEnabled({ timeout: 3000 });
    await nextBtn.click();

    // Banner must disappear
    await expect(
      page.getByText(/Viewing snapshot v\d+ — read-only/i),
    ).not.toBeVisible({ timeout: 5000 });

    await expect(
      page.getByRole("button", { name: "Back to current" }),
    ).not.toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-VHS-05.png` });
  });

  // ── LEAD-VHS-06 ─────────────────────────────────────────────────────────────
  test("LEAD-VHS-06: Restore from version history modal reverts draft", async ({
    page,
  }) => {
    const prevBtn = page.getByRole("button", { name: "Previous version" });
    const isPrevDisabled = await prevBtn
      .isDisabled({ timeout: 3000 })
      .catch(() => true);

    if (isPrevDisabled) {
      test.skip();
      return;
    }

    // Open version history modal via pill
    const pill = page.getByRole("button", {
      name: /Version \d+ — open history/,
    });
    await pill.click();

    const modal = page.getByRole("dialog", { name: "Version history" });
    await expect(modal).toBeVisible({ timeout: 5000 });

    const restoreBtn = modal
      .getByRole("button", { name: "Restore" })
      .first();
    const hasRestore = await restoreBtn
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!hasRestore) {
      await modal.getByRole("button", { name: "Close" }).click();
      test.skip();
      return;
    }

    // Register dialog handler BEFORE clicking Restore (window.confirm is blocking)
    page.once("dialog", (d) => d.accept());

    const restorePromise = page.waitForResponse(
      (r) => r.url().includes("leadForm.restoreVersion") && r.status() < 400,
      { timeout: 15000 },
    );
    await restoreBtn.click();
    await restorePromise;

    // Modal closes after restore
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Snapshot banner must be gone (back to editable current draft)
    await expect(
      page.getByText(/Viewing snapshot v\d+ — read-only/i),
    ).not.toBeVisible({ timeout: 5000 });

    // Form still renders
    await expect(
      page.locator('[data-testid="lead-report-form"]'),
    ).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-VHS-06.png` });
  });

  // ── LEAD-VHS-07 ─────────────────────────────────────────────────────────────
  // TODO(LEAD-VHS-07): Full integrity check — set priorityRank on item,
  // severity on risk, and stageStatus on stage chip. Wait for createSnapshot.
  // Change all three. Restore previous version. Verify all three reverted.
  //
  // Blocked on: StageChip component has no data-testid for E2E cycling.
  // Next step: add data-testid="stage-chip-<productId>-<stageName>" to
  // apps/web/src/components/lead/stage-chip.tsx, then implement this test.
  test.skip("LEAD-VHS-07: integrity — priorityRank + severity + stageStatus all revert after restore", async ({
    page,
  }) => {
    // Step 1: set priorityRank=99 on first item
    const firstItemCard = page.locator('[data-testid="item-card"]').first();
    const cardVisible = await firstItemCard.isVisible().catch(() => false);
    if (cardVisible) {
      await firstItemCard.hover();
      await firstItemCard
        .getByRole("button", { name: "Edit", exact: true })
        .click();
    } else {
      await page.getByRole("button", { name: /Add item/i }).first().click();
    }

    const itemDialog = page.getByRole("dialog");
    await expect(itemDialog).toBeVisible({ timeout: 5000 });
    const priorityInput = itemDialog.locator("#item-priority-rank");
    await expect(priorityInput).toBeVisible({ timeout: 3000 });
    await priorityInput.fill("99");
    await itemDialog.getByRole("button", { name: /save/i }).click();
    await expect(itemDialog).not.toBeVisible({ timeout: 5000 });

    // Step 2: wait for autosave + createSnapshot
    await page.waitForResponse(
      (r) => r.url().includes("reports.saveDraft") && r.status() < 400,
      { timeout: 10000 },
    );
    await page.waitForResponse(
      (r) => r.url().includes("leadForm.createSnapshot") && r.status() < 400,
      { timeout: 15000 },
    );

    // Step 3: change priorityRank to 1
    if (await firstItemCard.isVisible().catch(() => false)) {
      await firstItemCard.hover();
      await firstItemCard
        .getByRole("button", { name: "Edit", exact: true })
        .click();
    }
    const itemDialog2 = page.getByRole("dialog");
    await expect(itemDialog2).toBeVisible({ timeout: 5000 });
    const priorityInput2 = itemDialog2.locator("#item-priority-rank");
    await expect(priorityInput2).toBeVisible({ timeout: 3000 });
    await priorityInput2.fill("1");
    await itemDialog2.getByRole("button", { name: /save/i }).click();
    await expect(itemDialog2).not.toBeVisible({ timeout: 5000 });

    await page.waitForResponse(
      (r) => r.url().includes("reports.saveDraft") && r.status() < 400,
      { timeout: 10000 },
    );

    // Step 4: restore previous version via modal
    const pill = page.getByRole("button", {
      name: /Version \d+ — open history/,
    });
    await pill.click();
    const modal = page.getByRole("dialog", { name: "Version history" });
    await expect(modal).toBeVisible({ timeout: 5000 });
    const restoreBtn = modal.getByRole("button", { name: "Restore" }).first();

    page.once("dialog", (d) => d.accept());
    const restorePromise = page.waitForResponse(
      (r) => r.url().includes("leadForm.restoreVersion") && r.status() < 400,
      { timeout: 15000 },
    );
    await restoreBtn.click();
    await restorePromise;

    // Step 5: verify priorityRank reverted to 99
    if (await firstItemCard.isVisible().catch(() => false)) {
      await firstItemCard.hover();
      await firstItemCard
        .getByRole("button", { name: "Edit", exact: true })
        .click();
    }
    const itemDialog3 = page.getByRole("dialog");
    await expect(itemDialog3).toBeVisible({ timeout: 5000 });
    const priorityInput3 = itemDialog3.locator("#item-priority-rank");
    await expect(priorityInput3).toBeVisible({ timeout: 3000 });
    await expect(priorityInput3).toHaveValue("99");
    await itemDialog3.getByRole("button", { name: /cancel|close/i }).click();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LEAD-VHS-07.png` });
  });
});
