/**
 * Phase 39-06 (visual baseline 4/5) — Published reports archive.
 *
 * `/reports?tab=published` as head — viewer of the archive section. The
 * tab forces the published view (default for head/admin/viewer anyway,
 * but the explicit param avoids a flake if the role default ever flips).
 */
import { test, expect } from '../fixtures';
import { driftyMasks, freezeClock, waitForVisualStable } from './_helpers';

test('reports — published tab as head', async ({ headPage }) => {
  await freezeClock(headPage);
  await headPage.goto('/reports?tab=published');
  await waitForVisualStable(headPage);
  await headPage
    .getByRole('heading', { name: 'Отчёты' })
    .waitFor({ state: 'visible', timeout: 15_000 });

  await expect(headPage).toHaveScreenshot('reports-published.png', {
    fullPage: true,
    mask: driftyMasks(headPage),
  });
});
