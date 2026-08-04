import { expect, test } from "@playwright/test";

import { loginAs } from "./fixtures";

interface PageEntry {
  readonly path: string;
  readonly auth: "public" | "lead" | "head";
}

const PAGES: readonly PageEntry[] = [
  // Public surfaces — no DB / no session required.
  { path: "/", auth: "public" },
  { path: "/auth/error", auth: "public" },
  // Lead-authenticated GET pages (waitUntil: domcontentloaded — no form interaction).
  { path: "/lead/report", auth: "lead" },
  { path: "/lead/history", auth: "lead" },
  // Head-authenticated GET pages.
  { path: "/head/dashboard", auth: "head" },
  { path: "/head/report", auth: "head" },
  { path: "/admin", auth: "head" },
];

test.describe("Mobile — no horizontal scroll @MOB-SCROLL", () => {
  for (const entry of PAGES) {
    test(`${entry.path} fits the viewport`, async ({
      page,
      context,
    }, testInfo) => {
      // Skip on the desktop project — only mobile-ios / mobile-android run this.
      expect(testInfo.project.name).not.toBe("chromium-integration");

      if (entry.auth !== "public") {
        await loginAs(context, { role: entry.auth });
      }

      await page.goto(entry.path, { waitUntil: "domcontentloaded" });

      // 1. CSS-level: html overflow-x must NOT be 'scroll' / 'auto'.
      await expect(page.locator("html")).toHaveCSS(
        "overflow-x",
        /(hidden|clip|visible)/,
      );

      // 2. Pixel-level: the document must not scroll horizontally.
      const fits = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(fits).toBe(true);
    });
  }
});
