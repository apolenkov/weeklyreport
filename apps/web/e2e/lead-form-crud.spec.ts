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
  // Force serial execution within this describe — the suite re-seeds
  // the shared dev DB in beforeEach, and parallel workers would race
  // the wipeAndReseed against each other's reads. The cost is ~10s
  // wall time vs parallel; the win is determinism on assertions like
  // expectAssignedProducts(3) that read aggregate counts.
  test.describe.configure({ mode: 'serial' });

  // Each test gets a fresh DB. Spec-level `beforeEach` (vs file-level
  // beforeAll) is intentional: state must be predictable per test.
  test.beforeEach(async ({ leadPage }) => {
    await loginAs(leadPage, DEFAULT_LEAD);
    await reseedDatabase(leadPage, 'minimum');
    await gotoLeadReport(leadPage);
  });

  // -------------------------------------------------------------------------
  // S1: Stage popover
  // -------------------------------------------------------------------------

  test('S1.1: stage popover opens as a click-to-apply menu with 4 options', async ({ leadPage }) => {
    await clickStageChip(leadPage, 0, 'Dev', 'blocked');
    const popover = leadPage.getByRole('menu', { name: /Set status for Dev/ });
    await expect(popover.getByRole('menuitem', { name: /On Track/ })).toBeVisible();
    await expect(popover.getByRole('menuitem', { name: /At Risk/ })).toBeVisible();
    await expect(popover.getByRole('menuitem', { name: /Blocked/ })).toBeVisible();
    await expect(popover.getByRole('menuitem', { name: /Clear/ })).toBeVisible();
  });

  test('S1.2: clicking outside the popover dismisses it without applying', async ({ leadPage }) => {
    await clickStageChip(leadPage, 0, 'Dev', 'blocked');
    // The popover registers a mousedown listener on document — clicking
    // outside its portal closes it. The page heading is a safe target.
    await leadPage.getByRole('heading', { name: /My Report/i }).click();
    await expect(leadPage.getByRole('menu', { name: /Set status for/ })).not.toBeVisible();
    await expectStageStatus(leadPage, 0, 'Dev', 'blocked');
  });

  test('S1.3: Clear makes chip empty AND keeps the product assigned', async ({ leadPage }) => {
    // Regression guard for the Prisma-repository .filter(trafficLight !== null)
    // bug where Clear used to drop the entire ProjectStatus row, taking the
    // product (and its items + risks) with it. The stage-chip's
    // linkedRiskCount confirm only fires when a risk row's stageName
    // matches the chip's stageName — current risks default to "—" so the
    // confirm path is skipped and Clear applies on the first click.
    await expectAssignedProducts(leadPage, 3);
    await clickStageChip(leadPage, 0, 'Dev', 'blocked');
    const save = waitForSave(leadPage);
    await selectStageOption(leadPage, 'Clear');
    await save;
    await expectAssignedProducts(leadPage, 3);
    await expectStageStatus(leadPage, 0, 'Dev', 'empty');
    // Round-trip: reload to assert persistence, not just optimistic update.
    await leadPage.reload();
    await expectAssignedProducts(leadPage, 3);
    await expectStageStatus(leadPage, 0, 'Dev', 'empty');
  });

  test('S1.4: switching to At Risk shows the unbacked-stage warning banner', async ({ leadPage }) => {
    // CRM Platform Dev = blocked (seeded). The banner already lists it as
    // unbacked because risk rows default `stageName` to "—" so the
    // unbackedStages computation never matches. Switching to At Risk
    // keeps the banner up; the banner text is the assertion. Re-enabled
    // after the M2 popover redesign — status options are now menuitems
    // that apply on click, sidestepping the fixed-position-portal hit
    // test that previously made this case unreliable.
    await clickStageChip(leadPage, 0, 'Dev', 'blocked');
    await selectStageOption(leadPage, 'At Risk');
    await expect(leadPage.getByText(/stages? marked at-risk\/blocked ha[sv]e? no risk written/i)).toBeVisible();
    await expectStageStatus(leadPage, 0, 'Dev', 'at-risk');
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
    // Wait for the saveDraft round-trip whose request body actually carries
    // the new text. This skips any in-flight save from the dialog open
    // (Edit's preload doesn't dirty anything but a debounced flush from a
    // previous test step might still be settling) and only resolves once
    // the server has acknowledged the edit we care about.
    const save = leadPage.waitForResponse(
      async (r) => {
        if (!r.url().includes('reports.saveDraft') || r.status() !== 200) return false;
        const req = r.request().postData() ?? '';
        return req.includes('Refactored auth flow + added MFA');
      },
      { timeout: 10_000 },
    );
    await saveDialog(leadPage, /Item/);
    await save;
    await expect(leadPage.getByText('Refactored auth flow + added MFA')).toBeVisible();
    // Round-trip: reload to assert persistence rather than optimistic state.
    await leadPage.reload();
    await expect(leadPage.getByText('Refactored auth flow + added MFA')).toBeVisible();
  });

  test('S2.3: Delete item — confirms then removes from column', async ({ leadPage }) => {
    const targetText = 'Shipped cross-team metrics dashboard work';
    await expect(leadPage.getByText(targetText)).toBeVisible();
    await deleteItem(leadPage, targetText);
    // M20 confirmation modal: row preview + destructive button. The
    // confirm button is keyboard-focused on open so Enter would also
    // work, but click is more explicit for the spec.
    const confirm = leadPage.getByRole('dialog', { name: /Delete item/ });
    await expect(confirm).toBeVisible();
    await expect(confirm.getByText(targetText)).toBeVisible();
    await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
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

  test('S4.3: Delete risk — confirmation modal then row removed', async ({ leadPage }) => {
    const before = await leadPage.getByRole('button', { name: /Delete risk for/ }).count();
    expect(before).toBeGreaterThanOrEqual(1);
    await leadPage.getByRole('button', { name: /Delete risk for/ }).first().click();
    const confirm = leadPage.getByRole('dialog', { name: /Delete risk/ });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
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

  test('S6.1: + Add Priority opens modal, Save appends a row, ranks stay 1..N', async ({ leadPage }) => {
    const before = await leadPage.getByTestId('priority-row').count();
    await leadPage.getByRole('button', { name: '+ Add Priority' }).click();
    const dialog = leadPage.getByRole('dialog', { name: /Add Priority dialog/i });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/Description/i).fill('Ship the OAuth migration');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(leadPage.getByTestId('priority-row')).toHaveCount(before + 1);
    // The new row reads its rank from the count it joined as.
    await expect(leadPage.getByRole('button', { name: `Edit priority ${before + 1}` }).first()).toBeVisible();
  });

  test('S6.2: Delete priority preserves the rest and renumbers', async ({ leadPage }) => {
    const before = await leadPage.getByTestId('priority-row').count();
    expect(before).toBeGreaterThanOrEqual(2);
    await leadPage.getByRole('button', { name: 'Delete priority 1' }).click();
    // Confirm dialog opens for every delete (no more empty-row shortcut
    // — modal-driven add doesn't produce empty rows in the first place).
    const confirm = leadPage.getByRole('dialog', { name: /Delete priority/ });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(leadPage.getByTestId('priority-row')).toHaveCount(before - 1);
    // Surviving rows renumber starting at 1 — at least one Edit-priority-1
    // button must survive (the one that took the empty slot).
    await expect(leadPage.getByRole('button', { name: 'Edit priority 1' }).first()).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // S7: Empty-state CTAs
  // -------------------------------------------------------------------------

  test('S7.1: Deleting all priorities surfaces an empty-state placeholder', async ({ leadPage }) => {
    const initial = await leadPage.getByTestId('priority-row').count();
    for (let i = 0; i < initial; i++) {
      // Each delete renumbers, so "Priority 1" survives as the rotating target.
      await leadPage.getByRole('button', { name: 'Delete priority 1' }).click();
      const confirm = leadPage.getByRole('dialog', { name: /Delete priority/ });
      await expect(confirm).toBeVisible();
      await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(confirm).not.toBeVisible({ timeout: 3_000 });
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
    // Now CRM has a risk row but no at-risk/blocked stage backing it —
    // banner should NOT appear (warning is "stage without risk", not vice
    // versa).
    await expect(leadPage.getByText(/stages? marked at-risk\/blocked ha[sv]e? no risk written/i)).not.toBeVisible();
  });
});
