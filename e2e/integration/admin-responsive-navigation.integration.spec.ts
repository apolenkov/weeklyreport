import path from "node:path";

import type { Locator, Page, Route, TestInfo } from "@playwright/test";

import { ADMIN_TABS } from "../../apps/web/src/features/admin/model/admin-tab-dependencies";
import {
  ADMIN_RESPONSIVE_CASES,
  type AdminResponsiveCase,
  MAX_DISPLAY_COUNT,
  readResponsiveSourceBinding,
} from "./admin-responsive-navigation-harness";
import { expect, test } from "./fixtures";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const SOURCE_BINDING = readResponsiveSourceBinding(REPO_ROOT);
const SETTINGS_SECTIONS = [
  ["identity", "Identity"],
  ["periods", "Periods"],
  ["reminders", "Reminders"],
  ["notifications", "Notifications"],
  ["integrations", "Integrations"],
] as const;
const EXPECTED_BADGE_TEXT = "99+";
const VIEWPORT_HEIGHT = 900;

function procedureNames(url: string): readonly string[] {
  const pathname = new URL(url).pathname;
  const marker = "/trpc/";
  const start = pathname.indexOf(marker);
  return start === -1
    ? []
    : decodeURIComponent(pathname.slice(start + marker.length)).split(",");
}

function patchedCountResponse(
  procedures: readonly string[],
  body: unknown,
): unknown {
  if (!Array.isArray(body)) return body;
  return (body as readonly unknown[]).map((entry, index) => {
    const procedure = procedures[index];
    return procedure === "admin.pendingReopenCount" ||
      procedure === "admin.dlqCount"
      ? { result: { data: { json: { count: MAX_DISPLAY_COUNT } } } }
      : entry;
  });
}

async function routeMaximumCounts(route: Route): Promise<void> {
  const procedures = procedureNames(route.request().url());
  if (
    !procedures.some(
      (name) =>
        name === "admin.pendingReopenCount" || name === "admin.dlqCount",
    )
  ) {
    await route.continue();
    return;
  }
  const response = await route.fetch();
  const body: unknown = await response.json();
  await route.fulfill({
    response,
    json: patchedCountResponse(procedures, body),
  });
}

async function expectWithinViewport(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const bounds = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      active: document.activeElement === element,
      bottom: rect.bottom,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      width: rect.width,
    };
  });
  expect(bounds).toMatchObject({ active: true });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth + 1);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight + 1);
  expect(bounds.width).toBeGreaterThan(0);
  expect(bounds.height).toBeGreaterThan(0);
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    )
    .toBeLessThanOrEqual(0);
}

async function attachCaseEvidence(
  testInfo: TestInfo,
  entry: AdminResponsiveCase,
): Promise<void> {
  await testInfo.attach(`admin-responsive-${entry.width}.json`, {
    body: Buffer.from(
      `${JSON.stringify(
        {
          artifact: "ADMIN_RESPONSIVE_NAVIGATION_CASE",
          source: await SOURCE_BINDING,
          inventory: entry,
        },
        null,
        2,
      )}\n`,
    ),
    contentType: "application/json",
  });
}

async function expectPrimaryNavigation(
  page: Page,
  entry: AdminResponsiveCase,
): Promise<void> {
  const compact = page.locator('select[aria-label="Admin tab"]');
  const wide = page.locator('nav[aria-label="Admin tabs"]');
  await expect(compact).toHaveValue("settings");
  await expect(
    compact
      .locator("option")
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value),
      ),
  ).resolves.toEqual(ADMIN_TABS);
  await expect(
    wide
      .locator("a")
      .evaluateAll((links) =>
        links.map((link) =>
          new URL((link as HTMLAnchorElement).href).searchParams.get("tab"),
        ),
      ),
  ).resolves.toEqual(ADMIN_TABS);
  await expect(compact).toBeVisible({ visible: entry.primary === "compact" });
  await expect(wide).toBeVisible({ visible: entry.primary === "wide" });
  const active =
    entry.primary === "compact"
      ? compact
      : wide.locator('a[aria-current="page"]');
  await active.focus();
  await expectWithinViewport(active);
}

async function expectStatusParity(
  page: Page,
  entry: AdminResponsiveCase,
): Promise<void> {
  const pairs = [
    ["mobile-reopen-tab-count", "reopen-tab-count"],
    ["mobile-jobs-tab-count", "jobs-tab-count"],
  ] as const;
  for (const [compactId, wideId] of pairs) {
    const compact = page.getByTestId(compactId);
    const wide = page.getByTestId(wideId);
    await expect(compact).toHaveText(EXPECTED_BADGE_TEXT);
    await expect(wide).toHaveText(EXPECTED_BADGE_TEXT);
    await expect(compact).toBeVisible({ visible: entry.primary === "compact" });
    await expect(wide).toBeVisible({ visible: entry.primary === "wide" });
  }
}

async function expectSettingsReachability(
  page: Page,
  entry: AdminResponsiveCase,
): Promise<void> {
  const compact = page.locator('select[aria-label="Settings section"]');
  const wide = page.locator('[role="tablist"]');
  await expect(compact).toBeVisible({ visible: entry.settings === "compact" });
  await expect(wide).toBeVisible({ visible: entry.settings === "wide" });
  for (const [value, label] of SETTINGS_SECTIONS) {
    const control =
      entry.settings === "compact"
        ? compact
        : page.getByRole("tab", { name: label, exact: true });
    if (entry.settings === "compact") await compact.selectOption(value);
    else await control.click();
    await expect(
      page.locator('[role="tab"]').filter({ hasText: label }),
    ).toHaveAttribute("aria-selected", "true");
    await control.focus();
    await expectWithinViewport(control);
    await expectNoDocumentOverflow(page);
  }
}

async function expectHolidaysInert(
  page: Page,
  entry: AdminResponsiveCase,
): Promise<void> {
  const compact = page.getByTestId("mobile-holidays-coming-soon");
  const wide = page.locator('[role="tab"][aria-disabled="true"]');
  await expect(compact).toBeVisible({ visible: entry.settings === "compact" });
  await expect(wide).toBeVisible({ visible: entry.settings === "wide" });
  const current = page.locator('[role="tab"][aria-selected="true"]');
  const selectedName = await current.textContent();
  if (entry.settings === "wide") {
    await wide.dispatchEvent("mousedown");
    await wide.dispatchEvent("click");
    await wide.dispatchEvent("keydown", { key: "Enter" });
    await wide.dispatchEvent("keydown", { key: " " });
  }
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveText(
    selectedName ?? "Integrations",
  );
}

test.describe("Admin responsive navigation source-bound harness", () => {
  for (const entry of ADMIN_RESPONSIVE_CASES) {
    test(`${entry.width}px preserves the complete responsive contract`, async ({
      adminPage,
    }, testInfo) => {
      await adminPage.setViewportSize({
        width: entry.width,
        height: VIEWPORT_HEIGHT,
      });
      await adminPage.route("**/trpc/**", routeMaximumCounts);
      await adminPage.goto("/admin?tab=settings", {
        waitUntil: "domcontentloaded",
      });
      await expect(
        adminPage.getByRole("heading", { name: "Settings" }),
      ).toBeVisible();

      await expectPrimaryNavigation(adminPage, entry);
      await expectStatusParity(adminPage, entry);
      await expectSettingsReachability(adminPage, entry);
      await expectHolidaysInert(adminPage, entry);
      await expectNoDocumentOverflow(adminPage);
      await attachCaseEvidence(testInfo, entry);
    });
  }
});
