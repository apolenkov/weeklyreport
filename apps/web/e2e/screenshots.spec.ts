/**
 * Background Research Screenshot Spec
 *
 * Purpose: visual research pass — capture full-page screenshots of all key
 * pages across 4 roles. No assertions. Output used to evaluate background
 * design directions (lines, patterns, accents) in a research memo.
 *
 * FROZEN CONTRACT: this spec is research-only. Screenshots are inputs for
 * .planning/memory/2026-05-14-background-research.md. No UI code changes
 * should follow from this spec without explicit user sign-off.
 * See CLAUDE.md § "UI/визуал — research before implementation".
 *
 * Auth: uses storageState files written by auth.setup.ts (per-role cookies).
 * Viewport: 1440×900 (desktop baseline).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { test, type Page } from "@playwright/test";

const AUTH_DIR = path.join(__dirname, ".auth");
const OUT_DIR = path.join(
  __dirname,
  "..",
  "playwright-report",
  "screenshots",
);

function withRole(role: "lead" | "head" | "admin" | "viewer") {
  return { storageState: path.join(AUTH_DIR, `${role}.json`) };
}

async function waitReady(page: Page) {
  await page.waitForSelector("#main-content", {
    state: "visible",
    timeout: 15_000,
  });
  await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });
}

const PAGES_BY_ROLE: Record<
  string,
  Array<{ path: string; name: string; waitForUrl?: (url: URL) => boolean }>
> = {
  lead: [
    {
      path: "/lead/report",
      name: "lead-report",
      waitForUrl: (url) => url.pathname.includes("/lead/report/"),
    },
    { path: "/reports?tab=drafts", name: "lead-drafts" },
  ],
  head: [
    { path: "/head/dashboard", name: "head-dashboard" },
    { path: "/reports", name: "head-reports" },
  ],
  admin: [
    { path: "/admin", name: "admin-home" },
    { path: "/admin?tab=reminders", name: "admin-reminders" },
    { path: "/admin?tab=settings", name: "admin-settings" },
  ],
  viewer: [{ path: "/head/dashboard", name: "viewer-dashboard" }],
};

// Ensure output directory exists
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

for (const [role, pages] of Object.entries(PAGES_BY_ROLE)) {
  test.describe(`screenshots — ${role}`, () => {
    for (const p of pages) {
      test(`${role}/${p.name}`, async ({ browser }) => {
        const ctx = await browser.newContext({
          ...withRole(role as "lead"),
          viewport: { width: 1440, height: 900 },
        });
        const page = await ctx.newPage();

        await page.goto(p.path);

        if (p.waitForUrl) {
          await page.waitForURL(p.waitForUrl, { timeout: 10_000 });
        }

        await waitReady(page);

        // Brief settle for animations/lazy-loaded data
        await page.waitForTimeout(800);

        await page.screenshot({
          path: path.join(OUT_DIR, `${role}-${p.name}.png`),
          fullPage: true,
        });

        await ctx.close();
      });
    }
  });
}
