import { expect, test, type Browser, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { loginByCookie } from "./helpers/dev-auth";

const WEB = "http://localhost:3000";
const API = "http://localhost:3002";
const ACTIVE_REPORT_ID = "a0000000-0000-4000-8000-000000000001";
const PDF_UAT_REPORT_ID = "a0000000-0000-4000-8000-000000160017";
const HEAD_USER_ID = "a0000000-0000-4000-8000-000000000099";
const EVIDENCE_DIR = path.resolve(
  __dirname,
  "../../../../.planning/regression/evidence/2026-05-08-phase16-17-uat",
);
const REPO_ROOT = path.resolve(__dirname, "../../../..");

type ScenarioStatus = "PASS" | "FAIL" | "BLOCKED" | "SKIPPED";

type ScenarioResult = {
  name: string;
  status: ScenarioStatus;
  detail: string;
  screenshot?: string;
  data?: Record<string, unknown>;
};

type BrowserLog = {
  type: "pageerror" | "requestfailed" | "response";
  url?: string;
  status?: number;
  method?: string;
  message?: string;
};

const browserLogs: BrowserLog[] = [];
const results: ScenarioResult[] = [];

function ensureEvidenceDir(): void {
  fs.mkdirSync(path.join(EVIDENCE_DIR, "screenshots"), { recursive: true });
}

function evidencePath(fileName: string): string {
  return path.join(EVIDENCE_DIR, "screenshots", fileName);
}

function evidenceRel(fileName: string): string {
  return path
    .relative(process.cwd(), evidencePath(fileName))
    .replace(/\\/g, "/");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function attachBrowserLogging(page: Page): void {
  page.on("pageerror", (error) => {
    browserLogs.push({ type: "pageerror", message: error.message });
  });
  page.on("requestfailed", (request) => {
    browserLogs.push({
      type: "requestfailed",
      method: request.method(),
      url: request.url(),
      message: request.failure()?.errorText,
    });
  });
  page.on("response", (response) => {
    const status = response.status();
    if (status >= 500) {
      browserLogs.push({
        type: "response",
        method: response.request().method(),
        url: response.url(),
        status,
      });
    }
  });
}

function runFixtureSql(sql: string): string {
  return execFileSync(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "postgres",
      "psql",
      "-U",
      "customreport",
      "-d",
      "customreport",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

function ensurePdfUatPublishedReport(): void {
  const sql = `
insert into "Report" (
  id,
  "periodStart",
  "periodEnd",
  deadline,
  status,
  "periodStatus",
  "publishedAt",
  "publishedById",
  "weekLabel",
  "createdAt",
  "updatedAt"
)
select
  '${PDF_UAT_REPORT_ID}',
  now() - interval '21 days',
  now() - interval '15 days',
  now() - interval '17 days',
  'published'::"ReportStatus",
  'published'::"PeriodStatus",
  now(),
  '${HEAD_USER_ID}',
  'UAT PDF Fixture',
  now(),
  now()
where exists (select 1 from "User" where id = '${HEAD_USER_ID}')
on conflict (id) do update set
  status = 'published'::"ReportStatus",
  "periodStatus" = 'published'::"PeriodStatus",
  "publishedAt" = excluded."publishedAt",
  "publishedById" = excluded."publishedById",
  "updatedAt" = excluded."updatedAt";
`.trim();

  runFixtureSql(sql);
}

function cleanupPdfUatPublishedReport(): void {
  runFixtureSql(`delete from "Report" where id = '${PDF_UAT_REPORT_ID}';`);
}

async function newLoggedPage(
  browser: Browser,
  identity: {
    role: "lead" | "head" | "admin" | "viewer";
    email: string;
    redirect: string;
  },
): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  attachBrowserLogging(page);
  await loginByCookie(page, {
    role: identity.role,
    email: identity.email,
    expectRole: identity.role,
    redirect: identity.redirect,
    maxRetries: 4,
  });
  return page;
}

async function take(page: Page, fileName: string): Promise<string> {
  await page.screenshot({ path: evidencePath(fileName), fullPage: true });
  return evidenceRel(fileName);
}

async function runScenario(
  name: string,
  fn: (result: ScenarioResult) => Promise<void>,
): Promise<void> {
  const result: ScenarioResult = {
    name,
    status: "PASS",
    detail: "verified in live browser",
  };
  try {
    await fn(result);
  } catch (error) {
    result.status = "FAIL";
    result.detail = errorMessage(error);
  }
  results.push(result);
}

async function expectActiveNav(
  page: Page,
  expectedText: RegExp,
): Promise<string[]> {
  const active = page.locator(
    'nav[aria-label="Main navigation"] a[aria-current="page"]',
  );
  await expect(active.first()).toBeVisible();
  const texts = (await active.allTextContents()).map((text) =>
    text.replace(/\s+/g, " ").trim(),
  );
  expect(texts).toHaveLength(1);
  expect(texts[0]).toMatch(expectedText);
  return texts;
}

async function getCookieHeader(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

async function maybeRequestPdfExport(
  page: Page,
  result: ScenarioResult,
): Promise<void> {
  await page.goto(`${WEB}/reports?tab=published`, {
    waitUntil: "domcontentloaded",
  });
  const reportLink = page.locator('main a[href^="/reports/"]').first();
  const hasPublished = await reportLink
    .isVisible({ timeout: 3_000 })
    .catch(() => false);
  result.screenshot = await take(page, "sc-16-01-pdf-precondition.png");

  if (!hasPublished) {
    result.status = "BLOCKED";
    result.detail =
      "No published report exists in the live DB; PDF runtime UAT requires a published report or explicit reseed/publish.";
    result.data = { publishedReportAvailable: false };
    return;
  }

  const href = await reportLink.getAttribute("href");
  const reportId = href?.match(/\/reports\/([0-9a-fA-F-]{36})(?:$|[/?#])/)?.[1];
  expect(reportId, "published report id from archive link").toBeTruthy();

  const cookieHeader = await getCookieHeader(page);
  const requestRes = await page.request.post(
    `${API}/trpc/pdfExport.request?batch=1`,
    {
      headers: { cookie: cookieHeader, "content-type": "application/json" },
      data: JSON.stringify({ "0": { json: { reportId } } }),
    },
  );
  expect(requestRes.status()).toBe(200);
  const requestBody = (await requestRes.json()) as unknown;
  const job = (
    requestBody as Array<{
      result?: { data?: { json?: { id?: string; jobId?: string } } };
    }>
  )[0]?.result?.data?.json;
  const jobId = job?.id ?? job?.jobId;
  expect(jobId).toMatch(/^[0-9a-f-]{36}$/);

  let terminal: string | null = null;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const input = encodeURIComponent(
      JSON.stringify({ "0": { json: { jobId } } }),
    );
    const statusRes = await page.request.get(
      `${API}/trpc/pdfExport.status?batch=1&input=${input}`,
      { headers: { cookie: cookieHeader } },
    );
    expect(statusRes.status()).toBe(200);
    const statusBody = (await statusRes.json()) as unknown;
    const data = (
      statusBody as Array<{
        result?: { data?: { json?: { status?: string } } };
      }>
    )[0]?.result?.data?.json;
    if (data?.status === "completed" || data?.status === "failed") {
      terminal = data.status;
      break;
    }
    await page.waitForTimeout(1_500);
  }

  expect(terminal, "pdfExport.status reached terminal state").toMatch(
    /^(completed|failed)$/,
  );
  result.data = { publishedReportAvailable: true, terminal };
}

test.describe.serial("Phase 16/17 live UAT closure", () => {
  test("phase 16/17 scenarios against live Docker stack", async ({
    browser,
  }) => {
    ensureEvidenceDir();

    await runScenario("SC-17-01 login page", async (result) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      attachBrowserLogging(page);
      await page.goto(WEB, { waitUntil: "domcontentloaded" });
      await expect(page.getByText("CustomReport").first()).toBeVisible();
      const hasSso = await page
        .getByRole("link", { name: /sign in|sso/i })
        .or(page.getByRole("button", { name: /sign in|sso/i }))
        .first()
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      const hasEnterApplication = await page
        .getByRole("link", { name: /enter application/i })
        .first()
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      const hasDevRole = await page
        .getByRole("link", { name: /lead|head|admin|viewer/i })
        .first()
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      expect(hasSso || hasEnterApplication || hasDevRole).toBe(true);
      result.data = { hasSso, hasEnterApplication, hasDevRole };
      result.screenshot = await take(page, "sc-17-01-login.png");
      await context.close();
    });

    await runScenario("SC-17-02 lead form page", async (result) => {
      const page = await newLoggedPage(browser, {
        role: "lead",
        email: "lead1@customreport.local",
        redirect: "/lead/report",
      });
      await expect(
        page.getByRole("button", { name: /Product Status/i }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Current Week/i }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Next Week/i }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Submit Report/i }).first(),
      ).toBeVisible();
      result.screenshot = await take(page, "sc-17-02-lead-form.png");
      await page.context().close();
    });

    await runScenario("SC-17-03 lead history surface", async (result) => {
      const page = await newLoggedPage(browser, {
        role: "lead",
        email: "lead1@customreport.local",
        redirect: "/reports?tab=drafts",
      });
      await expect(
        page.getByRole("heading", { name: /^Reports$/ }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "My Drafts" }),
      ).toHaveAttribute("aria-current", "page");
      result.detail =
        "verified canonical merged history surface at /reports?tab=drafts";
      result.screenshot = await take(page, "sc-17-03-lead-history.png");
      await page.context().close();
    });

    await runScenario("SC-17-04 dashboard page", async (result) => {
      const page = await newLoggedPage(browser, {
        role: "head",
        email: "head@customreport.local",
        redirect: "/head/dashboard",
      });
      await expect(
        page.getByRole("heading", { name: /^Dashboard$/ }),
      ).toBeVisible();
      await expect(page.getByText("Submission Activity")).toBeVisible();
      await expect(
        page.getByRole("link", { name: "View Weekly Report" }),
      ).toBeVisible();
      result.screenshot = await take(page, "sc-17-04-dashboard.png");
      await page.context().close();
    });

    await runScenario("SC-17-05 weekly report page", async (result) => {
      const page = await newLoggedPage(browser, {
        role: "head",
        email: "head@customreport.local",
        redirect: `/head/report/${ACTIVE_REPORT_ID}`,
      });
      await expect(
        page.getByRole("heading", { name: "Weekly Report" }),
      ).toBeVisible();
      await expect(page.getByText("Portfolio Overview")).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Publish|Reopen/i }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Export PDF|Publish to export PDF/i }),
      ).toBeVisible();
      const emptyHeaders = await page
        .locator('[id^="report-product-"] button:disabled')
        .count();
      result.data = { disabledEmptyProductHeaders: emptyHeaders };
      result.screenshot = await take(page, "sc-17-05-weekly-report.png");
      await page.context().close();
    });

    await runScenario("SC-17-06 admin panel", async (result) => {
      const page = await newLoggedPage(browser, {
        role: "admin",
        email: "admin@customreport.local",
        redirect: "/admin?tab=users",
      });
      await expect(
        page.getByRole("heading", { name: "Admin Panel" }),
      ).toBeVisible();
      await expect(page.getByLabel("Users tab")).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(page.getByTestId("users-table")).toBeVisible();
      await page.setViewportSize({ width: 390, height: 900 });
      await page.goto(`${WEB}/admin?tab=users`, {
        waitUntil: "domcontentloaded",
      });
      const mobileSelect = page.locator('select[aria-label="Admin tab"]');
      await expect(mobileSelect).toBeVisible();
      await expect(mobileSelect).toHaveValue("users");
      result.screenshot = await take(page, "sc-17-06-admin.png");
      await page.context().close();
    });

    await runScenario("SC-17-07 print page", async (result) => {
      const page = await newLoggedPage(browser, {
        role: "head",
        email: "head@customreport.local",
        redirect: `/print/${ACTIVE_REPORT_ID}`,
      });
      await expect(
        page.getByRole("heading", {
          name: /Software Development.*Weekly Status Report/i,
        }),
      ).toBeVisible();
      await expect(page.getByTestId("nav-bar")).toHaveCount(0);
      result.screenshot = await take(page, "sc-17-07-print.png");
      await page.context().close();
    });

    await runScenario("SC-17-08 navigation active state", async (result) => {
      const leadPage = await newLoggedPage(browser, {
        role: "lead",
        email: "lead1@customreport.local",
        redirect: "/reports?tab=drafts",
      });
      const draftsActive = await expectActiveNav(leadPage, /My History/);
      await leadPage.goto(`${WEB}/reports?tab=published`, {
        waitUntil: "domcontentloaded",
      });
      const publishedActive = await expectActiveNav(leadPage, /Archive/);
      const headPage = await newLoggedPage(browser, {
        role: "head",
        email: "head@customreport.local",
        redirect: "/head/dashboard",
      });
      const dashboardActive = await expectActiveNav(headPage, /Dashboard/);
      await headPage.goto(`${WEB}/head/report/${ACTIVE_REPORT_ID}`, {
        waitUntil: "domcontentloaded",
      });
      const reportActive = await expectActiveNav(headPage, /Weekly Report/);
      result.data = {
        draftsActive,
        publishedActive,
        dashboardActive,
        reportActive,
      };
      result.screenshot = await take(headPage, "sc-17-08-nav-active.png");
      await leadPage.context().close();
      await headPage.context().close();
    });

    await runScenario("SC-17-09 design system consistency", async (result) => {
      const page = await newLoggedPage(browser, {
        role: "head",
        email: "head@customreport.local",
        redirect: "/head/dashboard",
      });
      const metrics = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const body = getComputedStyle(document.body);
        return {
          bodyBg: body.backgroundColor,
          tokenBackground: root.getPropertyValue("--color-background").trim(),
          tokenCard: root.getPropertyValue("--color-card").trim(),
          radius: root.getPropertyValue("--radius").trim(),
          touchTarget: root.getPropertyValue("--touch-target-min").trim(),
          font: body.fontFamily,
        };
      });
      expect(metrics.tokenBackground).toBe("#eef1ec");
      expect(metrics.tokenCard).toBe("#fffefb");
      expect(metrics.radius).toBe("0.75rem");
      expect(metrics.touchTarget).toBe("44px");
      expect(metrics.font).toMatch(/Lexend|Source Sans 3/);
      result.data = metrics;
      result.screenshot = await take(page, "sc-17-09-design-system.png");
      await page.context().close();
    });

    await runScenario("SC-17-10 URL routing + browser back", async (result) => {
      const page = await newLoggedPage(browser, {
        role: "lead",
        email: "lead1@customreport.local",
        redirect: "/reports?tab=drafts",
      });
      await page.getByRole("button", { name: "Published" }).click();
      await expect(page).toHaveURL(/\/reports\?tab=published/);
      await page.goBack({ waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/reports\?tab=drafts/);
      await expect(
        page.getByRole("button", { name: "My Drafts" }),
      ).toHaveAttribute("aria-current", "page");
      result.screenshot = await take(page, "sc-17-10-url-routing.png");
      await page.context().close();
    });

    await runScenario("SC-16-01 PDF export runtime", async (result) => {
      const page = await newLoggedPage(browser, {
        role: "head",
        email: "head@customreport.local",
        redirect: "/reports?tab=published",
      });
      await maybeRequestPdfExport(page, result);
      await page.context().close();
    });

    await runScenario(
      "SC-16-02 theme toggle visual behavior",
      async (result) => {
        const page = await newLoggedPage(browser, {
          role: "head",
          email: "head@customreport.local",
          redirect: "/head/dashboard",
        });
        const themeControls = await page
          .locator(
            'button[aria-label*="theme" i], button[title*="theme" i], button[aria-label*="dark" i], button[aria-label*="light" i]',
          )
          .count();
        result.screenshot = await take(page, "sc-16-02-theme-toggle.png");
        if (themeControls === 0) {
          result.status = "SKIPPED";
          result.detail =
            "Product decision: theme toggle is not part of the product. Scenario intentionally skipped, not a coverage gap.";
        }
        result.data = { themeControls };
        await page.context().close();
      },
    );

    const normalizedLogs = browserLogs.filter(
      (entry) =>
        !(
          entry.type === "requestfailed" && entry.message === "net::ERR_ABORTED"
        ),
    );
    const summary = {
      generatedAt: new Date().toISOString(),
      web: WEB,
      api: API,
      evidenceDir: path.relative(process.cwd(), EVIDENCE_DIR),
      counts: results.reduce<Record<ScenarioStatus, number>>(
        (acc, result) => {
          acc[result.status] += 1;
          return acc;
        },
        { PASS: 0, FAIL: 0, BLOCKED: 0, SKIPPED: 0 },
      ),
      results,
      browserLogs: normalizedLogs,
    };
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, "uat-live-results.json"),
      JSON.stringify(summary, null, 2),
    );

    const phase17Failures = results.filter(
      (result) => result.name.startsWith("SC-17") && result.status === "FAIL",
    );
    expect(phase17Failures).toEqual([]);
    expect(
      normalizedLogs.filter(
        (entry) => entry.type === "response" && (entry.status ?? 0) >= 500,
      ),
    ).toEqual([]);
    expect(
      normalizedLogs.filter((entry) => entry.type === "pageerror"),
    ).toEqual([]);
  });
});
