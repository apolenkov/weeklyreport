/**
 * Phase 39-06 (visual baseline 3/5) — Head dashboard.
 *
 * Uses headPage fixture (head@customreport.local). The dashboard renders
 * the AI summary card (stubbed via AI_VISUAL_STUB=true on the API), the
 * traffic-light overview, and the activity-live panel — all of which are
 * sensitive to time / AI output, so determinism matters here most.
 */
import { test, expect } from '../fixtures';
import { driftyMasks, freezeClock, waitForVisualStable } from './_helpers';

test('head dashboard — assembled portfolio view', async ({ headPage }) => {
  await freezeClock(headPage);
  await headPage.goto('/head/dashboard');
  await waitForVisualStable(headPage);
  // Dashboard heading appears once tRPC initial queries resolve.
  await headPage
    .getByRole('heading', { level: 1 })
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 });

  await expect(headPage).toHaveScreenshot('head-dashboard.png', {
    fullPage: true,
    mask: driftyMasks(headPage),
  });
});
