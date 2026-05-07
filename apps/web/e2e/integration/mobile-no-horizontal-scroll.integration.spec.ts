/**
 * MOB-01 (Phase 30-04): mobile no-horizontal-scroll contract.
 *
 * Asserts that on mobile viewports (iPhone 14: 390x844, Pixel 7: 412x915)
 * the document does not scroll horizontally. Two assertions per page:
 *
 *   1. CSS-level: html[overflow-x] must NOT be 'scroll' / 'auto'.
 *   2. Pixel-level: documentElement.scrollWidth <= window.innerWidth.
 *
 * The spec self-skips on the desktop chromium-integration project — it
 * only ever runs on mobile-ios / mobile-android.
 *
 * Per the 30-04 plan: it is acceptable for some pages to fail on the
 * very first run (e.g. head dashboard portfolio table at 375px) — the
 * failure is the SIGNAL 30-05 must fix.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures';

type PageEntry = {
  readonly path: string;
  readonly auth: 'public' | 'lead' | 'head';
};

const PAGES: ReadonlyArray<PageEntry> = [
  // Public surfaces — no DB / no session required.
  { path: '/', auth: 'public' },
  { path: '/auth/error', auth: 'public' },
  // Lead-authenticated GET pages (waitUntil: domcontentloaded — no form interaction).
  { path: '/lead/report', auth: 'lead' },
  { path: '/lead/history', auth: 'lead' },
  // Head-authenticated GET pages.
  { path: '/head/dashboard', auth: 'head' },
  { path: '/head/report', auth: 'head' },
  { path: '/admin', auth: 'head' },
];

test.describe('Mobile — no horizontal scroll @MOB-01', () => {
  for (const entry of PAGES) {
    test(`${entry.path} fits the viewport`, async ({ page, context }, testInfo) => {
      // Skip on the desktop project — only mobile-ios / mobile-android run this.
      expect(testInfo.project.name).not.toBe('chromium-integration');

      if (entry.auth !== 'public') {
        await loginAs(context, { role: entry.auth });
      }

      await page.goto(entry.path, { waitUntil: 'domcontentloaded' });

      // 1. CSS-level: html overflow-x must NOT be 'scroll' / 'auto'.
      await expect(page.locator('html')).toHaveCSS(
        'overflow-x',
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
