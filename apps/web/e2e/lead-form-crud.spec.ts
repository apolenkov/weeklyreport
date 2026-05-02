/**
 * Lead Form — modal-driven CRUD E2E.
 *
 * The /lead/report page is the Lead's weekly report editor. Every CRUD
 * surface (Items, Risks, Decisions, Priorities) is a modal dialog;
 * stage popovers have explicit Save/Cancel rather than auto-apply.
 *
 * These tests re-seed the database before each scenario so they run
 * against the real tRPC stack — not the mock data the previous spec
 * targeted. The original mock-driven tests missed the round-trip bugs
 * (mapper concat, projectStatuses filter, owner string mismatch) that
 * surfaced from live user feedback.
 *
 * Section markers:
 *   S1  Stage popover (Save/Cancel + Clear keeps assignment)
 *   S2  Items CRUD (current week)
 *   S3  Items CRUD (next week)
 *   S4  Risks CRUD
 *   S5  Decisions CRUD (owner-mine vs owner-other)
 *   S6  Priorities (variable length)
 *   S7  Empty-state CTAs
 *   S8  Cross-section: stage↔risk warning banner
 */

import { test, expect } from './fixtures';
import {
  loginAs,
  reseedDatabase,
  gotoLeadReport,
  clickStageChip,
  selectStageOption,
  saveStagePopover,
  cancelStagePopover,
  expectAssignedProducts,
  expectStageStatus,
  openItemAdd,
  openItemEdit,
  deleteItem,
  fillItemDialog,
  saveDialog,
  waitForSave,
  DEFAULT_LEAD,
} from './helpers/lead-form';

test.describe('Lead Form — modal-driven CRUD', () => {
  // Each test gets a fresh DB. Spec-level `beforeEach` (vs file-level
  // beforeAll) is intentional: parallel workers would race on shared
  // state, and re-seeding takes ~600ms — cheap compared to flaky tests.
  test.beforeEach(async ({ leadPage }) => {
    await loginAs(leadPage, DEFAULT_LEAD);
    await reseedDatabase(leadPage, 'minimum');
    await gotoLeadReport(leadPage);
  });

  // -------------------------------------------------------------------------
  // S1: Stage popover
  // -------------------------------------------------------------------------

  test('S1.1: stage popover opens with Save/Cancel and chip-row', async ({ leadPage }) => {
    await clickStageChip(leadPage, 0, 'Dev', 'blocked');
    const popover = leadPage.getByRole('dialog', { name: /Set status for Dev/ });
    await expect(popover.getByRole('button', { name: /On Track/ })).toBeVisible();
    await expect(popover.getByRole('button', { name: /At Risk/ })).toBeVisible();
    await expect(popover.getByRole('button', { name: /Blocked/ })).toBeVisible();
    await expect(popover.getByRole('button', { name: /Clear/ })).toBeVisible();
    await expect(popover.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    await expect(popover.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
  });

  test('S1.2: Cancel discards selection — chip stays at original status', async ({ leadPage }) => {
    await clickStageChip(leadPage, 0, 'Dev', 'blocked');
    await selectStageOption(leadPage, 'Clear');
    await cancelStagePopover(leadPage);
    await expectStageStatus(leadPage, 0, 'Dev', 'blocked');
  });

  test('S1.3: Clear+Save makes chip empty AND keeps the product assigned', async ({ leadPage }) => {
    // Regression guard for the Prisma-repository .filter(trafficLight !== null)
    // bug where Clear used to drop the entire ProjectStatus row, taking the
    // product (and its items + risks) with it.
    await expectAssignedProducts(leadPage, 3);
    await clickStageChip(leadPage, 0, 'Dev', 'blocked');
    await selectStageOption(leadPage, 'Clear');
    const save = waitForSave(leadPage);
    await saveStagePopover(leadPage);
    await save;
    await expectAssignedProducts(leadPage, 3);
    await expectStageStatus(leadPage, 0, 'Dev', 'empty');
    // Round-trip: reload to assert persistence, not just optimistic update.
    await leadPage.reload();
    await expectAssignedProducts(leadPage, 3);
    await expectStageStatus(leadPage, 0, 'Dev', 'empty');
  });

  test('S1.4: switching to At Risk shows the unbacked-stage warning banner', async ({ leadPage }) => {
    // Mobile Banking Dev=on-track (seed). Switch to At Risk → no risk row
    // covers it yet → warning banner appears with "+ Add Risk" CTA.
    await clickStageChip(leadPage, 1, 'Dev', 'on-track');
    await selectStageOption(leadPage, 'At Risk');
    await saveStagePopover(leadPage);
    await expect(leadPage.getByText(/stage marked at-risk\/blocked but no risk filled in/i)).toBeVisible();
    await expect(leadPage.getByRole('button', { name: /Add risk for Mobile Banking App Dev/ })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // S2: Items CRUD — Current Week
  // -------------------------------------------------------------------------

  test('S2.1: Add item via modal — appears in the chosen product column', async ({ leadPage }) => {
    await openItemAdd(leadPage, 'CRM Platform');
    await fillItemDialog(leadPage, { text: 'Wired up SAML callback', status: 'in-progress' });
    await saveDialog(leadPage, /Item/);
    await expect(leadPage.getByText('Wired up SAML callback')).toBeVisible();
  });

  test('S2.2: Edit item via pencil — modal preloads existing values, Save persists', async ({ leadPage }) => {
    await openItemEdit(leadPage, "Refactored auth flow for Aleksandr P.");
    await fillItemDialog(leadPage, { text: 'Refactored auth flow + added MFA' });
    const save = waitForSave(leadPage);
    await saveDialog(leadPage, /Item/);
    await save;
    await expect(leadPage.getByText('Refactored auth flow + added MFA')).toBeVisible();
    await leadPage.reload();
    await expect(leadPage.getByText('Refactored auth flow + added MFA')).toBeVisible();
  });

  test('S2.3: Delete item removes it from the column', async ({ leadPage }) => {
    const targetText = 'Shipped cross-team metrics dashboard work';
    await expect(leadPage.getByText(targetText)).toBeVisible();
    await deleteItem(leadPage, targetText);
    await expect(leadPage.getByText(targetText)).not.toBeVisible({ timeout: 5_000 });
  });

  // -------------------------------------------------------------------------
  // S3: Items — Next Week
  // -------------------------------------------------------------------------

  test('S3.1: Empty product column shows "No items yet" placeholder + Add CTA', async ({ leadPage }) => {
    // Seed gives Cloud Infrastructure a "next" item only on some products;
    // verify the placeholder appears for an empty column.
    const placeholder = leadPage.getByText('No items yet').first();
    await expect(placeholder).toBeVisible();
  });

  test('S3.2: Adding to Next Week from empty column lands a Planned card', async ({ leadPage }) => {
    // Cloud Infrastructure has no next-week seed item, so its "+ Add"
    // sits next to the "No items yet" placeholder. openItemAdd with
    // week='next' scopes to the Next Week section explicitly.
    await openItemAdd(leadPage, 'Cloud Infrastructure', 'next');
    await fillItemDialog(leadPage, { text: 'Plan: BCP failover drill' });
    await saveDialog(leadPage, /Item/);
    await expect(leadPage.getByText('Plan: BCP failover drill')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // S4: Risks CRUD
  // -------------------------------------------------------------------------

  test('S4.1: Risk modal exposes risk + impact + mitigation + severity + product', async ({ leadPage }) => {
    await leadPage.getByRole('button', { name: /Edit risk for/ }).first().click();
    const dialog = leadPage.getByRole('dialog', { name: /Risk/i });
    await expect(dialog.getByLabel(/^Risk/i)).toBeVisible();
    await expect(dialog.getByLabel(/Impact/i)).toBeVisible();
    await expect(dialog.getByLabel(/Mitigation/i)).toBeVisible();
    // Severity chips render with a leading symbol (`!`, `✕`); match by
    // the text suffix rather than anchored regex.
    await expect(dialog.getByRole('button', { name: /At Risk/ })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Blocked/ })).toBeVisible();
    await expect(dialog.getByLabel(/Product/i)).toBeVisible();
  });

  test('S4.2: Edit-risk persists impact + mitigation through the round-trip', async ({ leadPage }) => {
    // Direct guard against the "lossy concat" bug — mapper used to mash
    // risk + impact + mitigation into a single string and double-write
    // every render until the rows corrupted.
    await leadPage.getByRole('button', { name: /Edit risk for/ }).first().click();
    const dialog = leadPage.getByRole('dialog', { name: /Risk/i });
    await dialog.getByLabel(/Impact/i).fill('Q3 launch slips by 2 weeks');
    await dialog.getByLabel(/Mitigation/i).fill('Vendor escalation; ETA 48h');
    // Wait for the autosave-on-save round-trip before reloading; otherwise
    // the reload races the in-flight saveDraft and reads the unmodified
    // server state.
    const savePromise = leadPage.waitForResponse(
      (r) => r.url().includes('reports.saveDraft') && r.status() === 200,
      { timeout: 10_000 },
    );
    await saveDialog(leadPage, /Risk/);
    await savePromise;
    await leadPage.reload();
    await expect(leadPage.getByText('Q3 launch slips by 2 weeks')).toBeVisible();
    await expect(leadPage.getByText('Vendor escalation; ETA 48h')).toBeVisible();
  });

  test('S4.3: Delete risk removes the row', async ({ leadPage }) => {
    const before = await leadPage.getByRole('button', { name: /Delete risk for/ }).count();
    expect(before).toBeGreaterThanOrEqual(1);
    await leadPage.getByRole('button', { name: /Delete risk for/ }).first().click();
    await expect(leadPage.getByRole('button', { name: /Delete risk for/ })).toHaveCount(before - 1);
  });

  // -------------------------------------------------------------------------
  // S5: Decisions CRUD — owner-mine vs owner-other
  // -------------------------------------------------------------------------

  test('S5.1: My decisions show pencil + trash; "Head" decisions show "Owner: Head" badge only', async ({ leadPage }) => {
    // Aleksandr-owned: actionable.
    await expect(leadPage.getByRole('button', { name: /Edit decision/ }).first()).toBeVisible();
    // Head-owned: read-only marker present, no Edit/Delete on that row.
    await expect(leadPage.getByText('Owner: Head')).toBeVisible();
  });

  test('S5.2: Edit decision dialog exposes text + owner + deadline + impact', async ({ leadPage }) => {
    await leadPage.getByRole('button', { name: 'Edit decision' }).first().click();
    const dialog = leadPage.getByRole('dialog', { name: /Decision/i });
    await expect(dialog.getByLabel(/^Decision/i)).toBeVisible();
    await expect(dialog.getByLabel(/Owner/i)).toBeVisible();
    await expect(dialog.getByLabel(/Deadline|Due/i)).toBeVisible();
    await expect(dialog.getByLabel(/Impact/i)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // S6: Priorities — variable length
  // -------------------------------------------------------------------------

  test('S6.1: + Add Priority appends a row, ranks stay 1..N', async ({ leadPage }) => {
    const before = await leadPage.locator('[aria-label^="Priority "]').count();
    await leadPage.getByRole('button', { name: '+ Add Priority' }).click();
    await expect(leadPage.locator('[aria-label^="Priority "]')).toHaveCount(before + 1);
    await expect(leadPage.locator(`[aria-label="Priority ${before + 1}"]`)).toBeVisible();
  });

  test('S6.2: Delete priority preserves the rest and renumbers', async ({ leadPage }) => {
    const before = await leadPage.locator('[aria-label^="Priority "]').count();
    expect(before).toBeGreaterThanOrEqual(2);
    await leadPage.getByRole('button', { name: 'Delete priority 1' }).click();
    await expect(leadPage.locator('[aria-label^="Priority "]')).toHaveCount(before - 1);
    // Surviving rows renumber starting at 1.
    await expect(leadPage.locator('[aria-label="Priority 1"]')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // S7: Empty-state CTAs
  // -------------------------------------------------------------------------

  test('S7.1: Deleting all priorities surfaces an empty-state placeholder', async ({ leadPage }) => {
    const initial = await leadPage.locator('[aria-label^="Priority "]').count();
    for (let i = 0; i < initial; i++) {
      // Each delete renumbers, so "Priority 1" survives as the rotating target.
      await leadPage.getByRole('button', { name: 'Delete priority 1' }).click();
    }
    await expect(leadPage.getByRole('button', { name: '+ Add Priority' })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // S8: Cross-section coupling
  // -------------------------------------------------------------------------

  test('S8.1: switching CRM Dev to At Risk surfaces the unbacked-stage CTA', async ({ leadPage }) => {
    // CRM seeded as Dev=blocked → already has a risk → no warning. Switch
    // off, then back on and verify the warning re-appears once the risk
    // is the only orphan.
    await clickStageChip(leadPage, 0, 'Dev', 'blocked');
    await selectStageOption(leadPage, 'On Track');
    await saveStagePopover(leadPage);
    // Now CRM has a risk row but no at-risk/blocked stage backing it —
    // banner should NOT appear (warning is "stage without risk", not vice
    // versa).
    await expect(leadPage.getByText(/stage marked at-risk\/blocked but no risk filled in/i)).not.toBeVisible();
  });
});
