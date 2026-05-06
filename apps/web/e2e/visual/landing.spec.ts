/**
 * Phase 39-06 (visual baseline 1/5) — Landing page entry card.
 *
 * The visual project runs with AUTH_DEV_MODE=true on the API, which makes
 * every cookieless request resolve to a DEV_SESSION (head). Hitting `/`
 * therefore ALWAYS redirects to /head/dashboard unless we suppress the
 * redirect — the page contract for that is `?stay=1` (see app/page.tsx).
 *
 * The captured baseline is the right-panel "Enter Application" card with
 * the Demo brand panel on the left — the exact frame that users land on
 * when they explicitly visit the root URL while keeping the redirect off.
 * This is the only way to baseline the landing surface without unwiring
 * the dev-mode auth fallback the rest of the suite depends on.
 */
import { test as base, expect } from '@playwright/test';
import { driftyMasks, freezeClock, waitForVisualStable } from './_helpers';

base('landing — entry card with Demo brand panel', async ({ page }) => {
  await freezeClock(page);
  await page.goto('/?stay=1');
  await waitForVisualStable(page);

  await expect(page).toHaveScreenshot('landing.png', {
    fullPage: true,
    mask: driftyMasks(page),
  });
});
