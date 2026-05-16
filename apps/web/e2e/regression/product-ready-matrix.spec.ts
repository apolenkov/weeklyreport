/**
 * Product-ready role and UI matrix.
 *
 * Targets the existing live dev stack at localhost:3000/3002 and deliberately
 * does not wipe or reseed the database. Use this for fast proof around role
 * isolation, nav active state, hover geometry, and per-scenario evidence.
 */

import { expect, test, type Page, type TestInfo } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

import { loginByCookie } from "./helpers/dev-auth";

const WEB = "http://localhost:3000";
const ACTIVE_REPORT_ID = "a0000000-0000-4000-8000-000000000001";
const EVIDENCE_DIR = path.resolve(
  __dirname,
  "../../../../.planning/regression/evidence/product-ready-matrix",
);

type Role = "lead" | "head" | "admin" | "viewer";

type ScenarioLogEntry = {
  readonly type: "console" | "response" | "requestfailed" | "pageerror";
  readonly level?: string;
  readonly method?: string;
  readonly status?: number;
  readonly url?: string;
  readonly message?: string;
  readonly requestId?: string | null;
};

type Scenario = {
  readonly id: string;
  readonly role: Role;
  readonly route: string;
  readonly expected: "loads" | "forbidden";
  readonly heading?: RegExp;
};

const ROLE_SCENARIOS: ReadonlyArray<Scenario> = [
  {
    id: "ROLE-CTX-002",
    role: "lead",
    route: "/head/dashboard",
    expected: "forbidden",
  },
  {
    id: "ROLE-CTX-003",
    role: "head",
    route: "/head/dashboard",
    expected: "loads",
    heading: /Dashboard/i,
  },
  {
    id: "ROLE-CTX-004",
    role: "admin",
    route: "/admin",
    expected: "loads",
    heading: /Admin Panel/i,
  },
  {
    id: "ROLE-CTX-005",
    role: "viewer",
    route: "/admin",
    expected: "forbidden",
  },
  {
    id: "ROLE-CTX-007",
    role: "viewer",
    route: "/reports?tab=published",
    expected: "loads",
    heading: /Reports|History/i,
  },
];

function ensureEvidenceDir(): void {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

async function startScenario(
  page: Page,
  scenarioId: string,
): Promise<ScenarioLogEntry[]> {
  const logs: ScenarioLogEntry[] = [];
  await page.route("**/trpc/**", async (route) => {
    await route.continue({
      headers: {
        ...route.request().headers(),
        "x-request-id": scenarioId,
        "x-scenario-id": scenarioId,
      },
    });
  });

  page.on("console", (message) => {
    logs.push({
      type: "console",
      level: message.type(),
      message: message.text(),
    });
  });
  page.on("response", (response) => {
    const url = response.url();
    if (!url.includes("/trpc/") && !url.includes("/health/")) return;
    logs.push({
      type: "response",
      method: response.request().method(),
      status: response.status(),
      url,
      requestId: response.headers()["x-request-id"] ?? null,
    });
  });
  page.on("requestfailed", (request) => {
    logs.push({
      type: "requestfailed",
      method: request.method(),
      url: request.url(),
      message: request.failure()?.errorText,
    });
  });
  page.on("pageerror", (error) => {
    logs.push({ type: "pageerror", message: error.message });
  });

  return logs;
}

async function finishScenario(
  page: Page,
  testInfo: TestInfo,
  scenarioId: string,
  logs: ReadonlyArray<ScenarioLogEntry>,
): Promise<void> {
  ensureEvidenceDir();
  const base = safeFileName(scenarioId);
  const screenshotPath = path.join(EVIDENCE_DIR, `${base}.png`);
  const logPath = path.join(EVIDENCE_DIR, `${base}.json`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  fs.writeFileSync(
    logPath,
    JSON.stringify(
      {
        scenarioId,
        url: page.url(),
        status: testInfo.status,
        expectedStatus: testInfo.expectedStatus,
        logs,
      },
      null,
      2,
    ),
  );
}

function unexpectedLogEntries(
  logs: ReadonlyArray<ScenarioLogEntry>,
): ScenarioLogEntry[] {
  return logs.filter((entry) => {
    if (entry.type === "requestfailed") {
      return entry.message !== "net::ERR_ABORTED";
    }
    if (entry.type === "response") {
      return (entry.status ?? 0) >= 500;
    }
    if (entry.type === "pageerror") {
      return true;
    }
    if (entry.type === "console") {
      return entry.level === "error";
    }
    return false;
  });
}

async function expectExactlyOneActiveNav(page: Page): Promise<void> {
  await page.locator('nav[aria-label="Main navigation"]').waitFor({
    state: "visible",
    timeout: 10_000,
  });
  await expect(
    page.locator('nav[aria-label="Main navigation"] a[aria-current="page"]'),
  ).toHaveCount(1);
}

async function waitForApiReady(page: Page): Promise<void> {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const response = await page.request
      .get("http://localhost:3002/health/ready")
      .catch(() => null);
    if (response?.ok()) return;
    await page.waitForTimeout(500);
  }
  throw new Error("API did not become ready before scenario navigation");
}

async function loginAndOpen(
  page: Page,
  role: Role,
  route: string,
  expected: "loads" | "forbidden",
): Promise<void> {
  await waitForApiReady(page);
  await loginByCookie(page, {
    role,
    redirect: route,
    expectRole: role,
    maxRetries: 4,
  });

  const attempts = expected === "loads" ? 2 : 1;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await waitForApiReady(page);
    await page.goto(`${WEB}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const forbidden = await page
      .locator("main", { hasText: /Page unavailable for your role/i })
      .isVisible({ timeout: 1_500 })
      .catch(() => false);
    if (expected === "forbidden" || !forbidden) return;
    await loginByCookie(page, {
      role,
      redirect: route,
      expectRole: role,
      maxRetries: 4,
    });
  }
}

test.describe("Product-ready role matrix and UI geometry", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(() => {
    ensureEvidenceDir();
  });

  for (const scenario of ROLE_SCENARIOS) {
    test(`${scenario.id} — ${scenario.role} opens ${scenario.route}`, async ({
      page,
    }, testInfo) => {
      const logs = await startScenario(page, scenario.id);
      await loginAndOpen(
        page,
        scenario.role,
        scenario.route,
        scenario.expected,
      );

      if (scenario.expected === "forbidden") {
        await expect(
          page.locator("main", { hasText: /Page unavailable for your role/i }),
        ).toBeVisible();
      } else {
        await expect(
          page.locator("main", { hasText: /Page unavailable for your role/i }),
        ).toHaveCount(0);
        if (scenario.heading) {
          await expect(
            page.getByRole("heading", { name: scenario.heading }).first(),
          ).toBeVisible();
        }
      }

      await finishScenario(page, testInfo, scenario.id, logs);
      expect(unexpectedLogEntries(logs)).toEqual([]);
    });
  }

  test("UI-GEO-001 — dashboard card hover keeps geometry stable", async ({
    page,
  }, testInfo) => {
    const scenarioId = "UI-GEO-001";
    const logs = await startScenario(page, scenarioId);
    await loginAndOpen(page, "head", "/head/dashboard", "loads");

    const card = page
      .locator('section[aria-labelledby="activity-live-heading"] li')
      .first();
    await expect(card).toBeVisible();

    const before = await card.boundingBox();
    expect(before, "card has bounding box before hover").not.toBeNull();
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, `${scenarioId}-before.png`),
      fullPage: true,
    });

    await card.hover();
    const after = await card.boundingBox();
    expect(after, "card has bounding box after hover").not.toBeNull();
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, `${scenarioId}-hover.png`),
      fullPage: true,
    });

    expect(
      Math.abs((after?.top ?? 0) - (before?.top ?? 0)),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs((after?.height ?? 0) - (before?.height ?? 0)),
    ).toBeLessThanOrEqual(1);

    await finishScenario(page, testInfo, scenarioId, logs);
    expect(unexpectedLogEntries(logs)).toEqual([]);
  });

  test("UI-GEO-002/003 — reports query tabs expose exactly one active nav item", async ({
    page,
  }, testInfo) => {
    const scenarioId = "UI-GEO-002-003";
    const logs = await startScenario(page, scenarioId);
    await loginAndOpen(page, "lead", "/reports?tab=drafts", "loads");

    await page.goto(`${WEB}/reports?tab=drafts`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await expectExactlyOneActiveNav(page);
    await expect(
      page.getByRole("link", { name: /^My History$/ }),
    ).toHaveAttribute("aria-current", "page");

    await page.goto(`${WEB}/reports?tab=published`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await expectExactlyOneActiveNav(page);
    await expect(page.getByRole("link", { name: /^Archive$/ })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await finishScenario(page, testInfo, scenarioId, logs);
    expect(unexpectedLogEntries(logs)).toEqual([]);
  });

  test("UI-GEO-004 — empty product sections are muted and non-expandable", async ({
    page,
  }, testInfo) => {
    const scenarioId = "UI-GEO-004";
    const logs = await startScenario(page, scenarioId);
    await loginAndOpen(
      page,
      "head",
      `/head/report/${ACTIVE_REPORT_ID}`,
      "loads",
    );

    const noContentText = page
      .locator("main")
      .getByText("No content submitted for this product.")
      .first();
    const hasEmptyProduct = await noContentText
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    test.skip(!hasEmptyProduct, "Current fixture has no empty product section");

    const productRoot = noContentText.locator(
      'xpath=ancestor::*[@id and starts-with(@id, "report-product-")]',
    );
    const toggle = productRoot.locator(
      'button[data-product-accordion-toggle="true"]',
    );

    await expect(toggle).toBeDisabled();
    await expect(toggle).toHaveAttribute("aria-disabled", "true");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(productRoot.getByText("No content").first()).toBeVisible();

    await finishScenario(page, testInfo, scenarioId, logs);
    expect(unexpectedLogEntries(logs)).toEqual([]);
  });

  test("UI-GEO-005 — dashboard deadline uses report deadline and reminder rule state", async ({
    page,
  }, testInfo) => {
    const scenarioId = "UI-GEO-005";
    const logs = await startScenario(page, scenarioId);
    await loginAndOpen(page, "head", "/head/dashboard", "loads");

    await expect(page.getByLabel(/Deadline: .*2026-05-08/)).toBeVisible();

    const reminderButton = page.getByRole("button", { name: "Send Reminder" });
    await expect(reminderButton).toBeVisible();

    const configureLink = page.getByRole("link", {
      name: /Configure reminders/i,
    });
    const needsReminderRule = await configureLink
      .isVisible({ timeout: 2_000 })
      .catch(() => false);
    if (needsReminderRule) {
      await expect(reminderButton).toBeDisabled();
      await expect(configureLink).toHaveAttribute(
        "href",
        "/admin?tab=reminders",
      );
    } else {
      await expect(reminderButton).toBeEnabled();
    }

    await expect(page.getByText(/No active reminder rule/i)).toHaveCount(0);
    await finishScenario(page, testInfo, scenarioId, logs);
    expect(unexpectedLogEntries(logs)).toEqual([]);
  });

  test("UI-GEO-006 — empty dashboard rows do not deep-link to blank reports", async ({
    page,
  }, testInfo) => {
    const scenarioId = "UI-GEO-006";
    const logs = await startScenario(page, scenarioId);
    await loginAndOpen(page, "head", "/head/dashboard", "loads");

    await expect(page.getByText("Submission Activity")).toBeVisible();
    await expect(
      page.locator(
        'section[aria-labelledby="activity-live-heading"] a[href*="authorId="]',
      ),
    ).toHaveCount(0);
    await expect(
      page.locator('main a[href*="/head/report/"][href*="authorId="]'),
    ).toHaveCount(0);

    await finishScenario(page, testInfo, scenarioId, logs);
    expect(unexpectedLogEntries(logs)).toEqual([]);
  });

  test("UI-GEO-007 — empty weekly report has no publish or bulk-toggle action", async ({
    page,
  }, testInfo) => {
    const scenarioId = "UI-GEO-007";
    const logs = await startScenario(page, scenarioId);
    await loginAndOpen(
      page,
      "head",
      `/head/report/${ACTIVE_REPORT_ID}`,
      "loads",
    );

    await expect(page.getByRole("button", { name: "Toggle All" })).toHaveCount(
      0,
    );
    const publishButton = page.getByRole("button", {
      name: /nothing to publish/i,
    });
    await expect(publishButton).toBeVisible();
    await expect(publishButton).toBeDisabled();
    await expect(
      page.getByRole("button", { name: /^publish & lock$/i }),
    ).toHaveCount(0);

    await finishScenario(page, testInfo, scenarioId, logs);
    expect(unexpectedLogEntries(logs)).toEqual([]);
  });
});
