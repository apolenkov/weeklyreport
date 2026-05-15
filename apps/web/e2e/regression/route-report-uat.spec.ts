import { expect, test, type Page } from "@playwright/test";

import { loginByCookie, wipeAndReseed } from "./helpers/dev-auth";

const HARD_FAILURE_TEXT =
  /Internal Server Error|Application error|Unhandled Runtime Error/i;
const ACTIVE_REPORT_ID = "a0000000-0000-4000-8000-000000000001";
const PUBLISHED_REPORT_ID = "a0000000-0000-4000-8000-000000000002";

test.setTimeout(180_000);

type FailureMonitor = {
  readonly failures: string[];
};

function monitorHardFailures(page: Page): FailureMonitor {
  const failures: string[] = [];

  page.on("pageerror", (error) => {
    failures.push(`pageerror: ${error.message}`);
  });

  page.on("response", (response) => {
    const status = response.status();
    if (status >= 500) {
      failures.push(`${status}: ${response.url()}`);
    }
  });

  return { failures };
}

async function expectStableAppPage(page: Page, monitor: FailureMonitor) {
  await expect(page.locator("#main-content")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(HARD_FAILURE_TEXT);
  expect(monitor.failures, monitor.failures.join("\n")).toEqual([]);
}

async function expectNoReloadLoop(page: Page) {
  const settledUrl = page.url();
  await page.waitForTimeout(750);
  expect(page.url()).toBe(settledUrl);
}

async function waitForAppReady(page: Page) {
  await expect(page.locator("#main-content")).toBeVisible();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {
    // Long-polling/dev overlays may keep the network busy; visible app shell is
    // the readiness signal for this live-stack UAT.
  });
}

async function archivePublishedReport(page: Page) {
  const response = await page.request.post(
    "/trpc/archive.archiveReport?batch=1",
    {
      data: JSON.stringify({
        "0": { json: { reportId: PUBLISHED_REPORT_ID } },
      }),
      headers: { "content-type": "application/json" },
    },
  );
  const body = await response.text();
  expect(response.ok(), body).toBe(true);
}

async function expectVisibleText(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).first()).toBeVisible();
}

let routeReportSeeded = false;

async function ensureRouteReportFixture(page: Page) {
  if (routeReportSeeded) return;

  await loginByCookie(page, {
    role: "admin",
    email: "admin@customreport.local",
    redirect: "/admin",
    expectRole: "admin",
    maxRetries: 4,
  });
  await wipeAndReseed(page, "advanced");

  await loginByCookie(page, {
    role: "head",
    email: "head@customreport.local",
    redirect: "/head/dashboard",
    expectRole: "head",
    maxRetries: 4,
  });
  await archivePublishedReport(page);

  routeReportSeeded = true;
}

test.describe("Route/report UAT smoke", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await ensureRouteReportFixture(page);
  });

  test("RR-001: head dashboard opens the addressed weekly report", async ({
    page,
  }) => {
    const monitor = monitorHardFailures(page);

    await loginByCookie(page, {
      role: "head",
      email: "head@customreport.local",
      redirect: "/head/dashboard",
      expectRole: "head",
      maxRetries: 4,
    });

    await waitForAppReady(page);
    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
    await expectVisibleText(page, "Submissions");
    await expectVisibleText(page, "4/4");
    await expectVisibleText(page, "Report Archive");
    await expectStableAppPage(page, monitor);
    await expectNoReloadLoop(page);

    const reportLink = page.getByRole("link", {
      name: /view status report/i,
    });
    await expect(reportLink).toBeVisible();
    await expect(reportLink).toHaveAttribute(
      "href",
      `/head/report/${ACTIVE_REPORT_ID}`,
    );

    await reportLink.click();
    await expect(page).toHaveURL(
      new RegExp(`/head/report/${ACTIVE_REPORT_ID}$`),
    );
    await waitForAppReady(page);
    await expect(
      page.getByRole("heading", { name: "Status Report" }).first(),
    ).toBeVisible();
    await expectVisibleText(page, "Live · 4/4 Submitted");
    await expectVisibleText(page, "Portfolio Overview");
    await expectVisibleText(page, "Маркетинговый портал");
    await expectVisibleText(page, "DevOps-инструменты");
    await expectVisibleText(page, /OAuth2/);
    await expectVisibleText(page, /PgBouncer/);
    await expectVisibleText(page, /WAF/);
    await expectStableAppPage(page, monitor);
    await expectNoReloadLoop(page);
  });

  test("RR-002: published archive and report viewer route are stable", async ({
    page,
  }) => {
    const monitor = monitorHardFailures(page);

    await loginByCookie(page, {
      role: "viewer",
      email: "viewer@customreport.local",
      redirect: "/reports?tab=published",
      expectRole: "viewer",
      maxRetries: 4,
    });

    await waitForAppReady(page);
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
    await expectVisibleText(page, "1 loaded");
    await expectStableAppPage(page, monitor);

    const reportCard = page.locator(
      `main a[href="/reports/${PUBLISHED_REPORT_ID}"]`,
    );
    await expect(reportCard).toBeVisible();

    const href = await reportCard.getAttribute("href");
    expect(href).toBe(`/reports/${PUBLISHED_REPORT_ID}`);

    await reportCard.click();
    await expect(page).toHaveURL(
      new RegExp(`/reports/${PUBLISHED_REPORT_ID}$`),
    );
    await waitForAppReady(page);
    await expect(
      page.getByRole("heading", { name: "Status Report" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to Archive" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Export PDF" })).toBeVisible();
    await expectVisibleText(page, "Portfolio Overview");
    await expectVisibleText(page, "Закрыли недельные цели");
    await expectVisibleText(page, "Маркетинговый портал");
    await expect(
      page.getByRole("button", { name: /Publish & Lock/i }),
    ).toHaveCount(0);
    await expectStableAppPage(page, monitor);
    await expectNoReloadLoop(page);
  });

  test("RR-003: lead report route canonicalizes without a skeleton loop", async ({
    page,
  }) => {
    const monitor = monitorHardFailures(page);

    await loginByCookie(page, {
      role: "lead",
      email: "lead1@customreport.local",
      redirect: "/lead/report",
      expectRole: "lead",
      maxRetries: 4,
    });

    await waitForAppReady(page);
    await expect(page).toHaveURL(
      new RegExp(`/lead/report/${ACTIVE_REPORT_ID}`),
    );
    await expect(
      page.getByRole("heading", { name: /Weekly Report|Report/i }),
    ).toBeVisible();
    await expectVisibleText(page, "Editing version");
    await expect(
      page.getByRole("button", { name: /Current Week/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Product Status/i }),
    ).toBeVisible();
    await expectVisibleText(page, "Маркетинговый портал");
    await expectVisibleText(page, "Аналитический хаб");
    await expectVisibleText(page, /OAuth2/);
    await expectVisibleText(page, /SSO/);
    await expectStableAppPage(page, monitor);
    await expectNoReloadLoop(page);
  });
});
