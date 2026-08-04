import { execFileSync } from "node:child_process";
import path from "node:path";

import type { DbRole } from "@customreport/shared";
import { type BrowserContext, expect, test } from "@playwright/test";

import type { SeedProfile } from "../../prisma/seed-profile-contract.js";
import { findRepoRoot } from "../integration/global-setup.js";

const repoRoot = findRepoRoot(import.meta.dirname);
const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl) throw new Error("E2E_DATABASE_URL not set");
const apiPort = process.env.E2E_API_PORT;
if (!apiPort) {
  throw new Error(
    "E2E_API_PORT not set — the seed-profile suite needs the explicit API port " +
      "(playwright.integration.config.ts supplies it to the web-server env).",
  );
}
const apiUrl = `http://127.0.0.1:${apiPort}`;

function seedProfile(profile: SeedProfile): void {
  execFileSync(
    process.execPath,
    ["--import", "tsx", path.join(repoRoot, "prisma/seed-profile.ts"), profile],
    {
      cwd: repoRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "inherit",
    },
  );
}

async function loginAs(
  context: BrowserContext,
  role: DbRole,
  email?: string,
): Promise<void> {
  const url = new URL(`${apiUrl}/auth/dev-login`);
  url.searchParams.set("role", role);
  if (email) url.searchParams.set("email", email);
  const response = await context.request.get(url.toString(), {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
}

test.describe.serial("named seed profile journeys", () => {
  test("minimal boots, authenticates, and opens its editable item", async ({
    browser,
  }) => {
    seedProfile("minimal");
    const context = await browser.newContext();
    await loginAs(context, "lead", "lead1@customreport.local");
    const page = await context.newPage();

    await page.goto("/lead/report");
    await expect(page.getByText("Minimal editable report item")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Edit$/ })).toBeVisible();
    await context.close();
  });

  test("demo exposes multi-role health and Mine/Everyone views", async ({
    browser,
  }) => {
    seedProfile("demo");
    const context = await browser.newContext();
    await loginAs(context, "lead", "lead1@customreport.local");
    const page = await context.newPage();

    await page.goto("/lead/report");
    await expect(page.getByRole("button", { name: "Mine only" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Everyone" })).toBeVisible();
    await page.getByRole("button", { name: "Everyone" }).click();
    await expect(page.getByText("Маркетинговый портал").first()).toBeVisible();
    await context.close();
  });

  test("full exposes admin catalogue and deep report history", async ({
    browser,
  }) => {
    seedProfile("full");
    const context = await browser.newContext();
    await loginAs(context, "admin");
    const page = await context.newPage();

    await page.goto("/admin/products");
    await expect(page.getByText("Аналитический хаб").first()).toBeVisible();
    await page.goto("/reports");
    await expect(page.getByText(/Week \d+/).first()).toBeVisible();
    await context.close();
  });

  test("stress retains full and exposes deterministic scroll volume", async ({
    browser,
  }) => {
    seedProfile("stress");
    const context = await browser.newContext();
    await loginAs(context, "admin");
    const page = await context.newPage();

    await page.goto("/admin/products");
    const filter = page.getByRole("searchbox", {
      name: "Filter products by name",
    });
    await filter.fill("Stress product 36");
    await expect(page.getByText("Stress product 36").first()).toBeVisible();
    await context.close();
  });
});
