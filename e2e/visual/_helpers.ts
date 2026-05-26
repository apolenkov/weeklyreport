/**
 * Phase 39-06 — Visual regression helpers.
 *
 * Three things every visual spec needs to do BEFORE navigating:
 *   1. Freeze the clock so "Week 19 · May 4–10 (current)" stays stable.
 *      Playwright 1.45+ ships `page.clock.install` which patches Date,
 *      performance.now(), setTimeout/Interval, requestAnimationFrame, etc.
 *      Must be called BEFORE goto() so the first React render sees the
 *      frozen time.
 *   2. After the page settles, mask any DOM nodes that are inherently
 *      time-relative (e.g. "обновлено 2 минуты назад") via the helper
 *      below.  Returned locator-array is fed straight into
 *      `toHaveScreenshot({ mask: ... })`.
 *   3. Wait for fonts + the main content + network idle. Without explicit
 *      font-load wait the diff oscillates between fallback and Geist on
 *      first paint.
 *
 * The frozen time is intentionally Wednesday 2026-05-06T10:00:00Z, which
 * matches the seed-simple anchor week.
 */

import type { Locator, Page } from "@playwright/test";

export const FROZEN_TIME = new Date("2026-05-06T10:00:00Z");

/**
 * Patch Date / setTimeout / requestAnimationFrame inside the page so every
 * "now"-derived UI element renders the same value across runs. Must be
 * called BEFORE page.goto().
 */
export async function freezeClock(page: Page): Promise<void> {
  await page.clock.install({ time: FROZEN_TIME });
  // setFixedTime is idempotent with install but documents intent: every
  // Date.now() call returns FROZEN_TIME and time does not advance.
  await page.clock.setFixedTime(FROZEN_TIME);
}

/**
 * Wait for the rendered page to be visually stable:
 *   - main content selector visible (Next App Router hydration)
 *   - fonts loaded (Geist via next/font — without this Tailwind text shifts)
 *   - network idle (tRPC initial queries done)
 *
 * `mainSelector` defaults to '#main-content', which the App Router shell
 * renders on every authed route. Public pages without it (e.g. /print)
 * pass `'main'`.
 */
export async function waitForVisualStable(
  page: Page,
  mainSelector = "#main-content",
): Promise<void> {
  await page.waitForSelector(mainSelector, {
    state: "visible",
    timeout: 15_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 15_000 });
  // Fonts may finish after networkidle (next/font loads via CSS without a
  // request after the .woff2 is cached). Catch the eval failure when a
  // race happens during navigation — the diff threshold absorbs the tiny
  // hinting drift that an unfinished font load could introduce.
  try {
    await page.evaluate(() => document.fonts.ready);
  } catch {
    // Navigation in flight or document gone — fall through.
  }
}

/**
 * Locator-list of common "drifty" DOM nodes that must be masked from the
 * screenshot diff. Add new selectors here when a real spec turns flaky on
 * a value the helper missed — masking keeps the regression tight by
 * hiding only what genuinely varies.
 */
export function driftyMasks(page: Page): Locator[] {
  return [
    // Generic <time> tags — used by activity feeds and history badges.
    page.locator("time"),
    // Activity-live panel relative-time strings ("X минут назад").
    page.locator('[data-testid="activity-live-relative-time"]'),
    // Any element opted-in via a stable test-id.
    page.locator("[data-visual-mask]"),
  ];
}
