/**
 * Lead-form E2E helpers — modal-driven flow on /lead/report.
 *
 * The page is a single Lead's report editor. Every CRUD section
 * (Items, Risks, Decisions, Priorities) is driven by a modal dialog,
 * not inline-edit. Stage popover has Save/Cancel ergonomics rather
 * than auto-apply.
 *
 * These helpers wrap interaction patterns that recur across the spec
 * so individual tests stay focused on the assertion they're actually
 * making, not on the click sequence to get there.
 */

import { type Page, type Locator, expect } from '@playwright/test';

const STAGES = ['Planning', 'Analysis', 'Design', 'Dev', 'Testing', 'DevOps', 'Support'] as const;
export type StageName = (typeof STAGES)[number];

export type StatusOption = 'On Track' | 'At Risk' | 'Blocked' | 'Clear';
export type ItemStatus = 'in-progress' | 'completed' | 'blocked' | 'planned';

/** Default lead identity used by every spec unless overridden. */
export const DEFAULT_LEAD = {
  role: 'lead' as const,
  email: 'platanov@customreport.local',
  displayName: 'Aleksandr P.',
};

/**
 * Log in via the dev-login endpoint. The handler issues an HttpOnly
 * cookie scoped to the web origin; subsequent navigation carries it
 * over and tRPC requests authenticate transparently.
 *
 * AUTH_DEV_MODE must be true on the API process for this to succeed —
 * the playwright.config.ts webServer block sets that env var.
 */
export async function loginAs(
  page: Page,
  identity: { role: 'lead' | 'head' | 'admin' | 'viewer'; email: string; next?: string },
) {
  const params = new URLSearchParams({
    role: identity.role,
    email: identity.email,
    next: identity.next ?? '/',
  });
  await page.goto(`/auth/dev-login?${params.toString()}`);
}

/**
 * Reseed the database via the dev-only `dev.wipeAndReseed` tRPC mutation.
 * Call once per spec (or at file scope) to guarantee a clean start —
 * tests run in parallel and would otherwise corrupt each other's state.
 *
 * Requires an authenticated session, so call after `loginAs`.
 */
export async function reseedDatabase(page: Page, variant: 'minimum' | 'advanced' = 'minimum') {
  const body = JSON.stringify({ '0': { json: { variant } } });
  const response = await page.request.post('/trpc/dev.wipeAndReseed?batch=1', {
    data: body,
    headers: { 'content-type': 'application/json' },
  });
  if (!response.ok()) {
    throw new Error(`reseed failed: ${response.status()} ${await response.text()}`);
  }
}

/**
 * Wait for the next `reports.saveDraft` round-trip to complete with a 200.
 *
 * Use *before* a reload-assert: the form autosaves on a debounce, so the
 * mutation we just triggered (closing a dialog, picking a stage status)
 * may still be in-flight when the test calls `page.reload()`. Without
 * this barrier the reload races the save and reads stale server state.
 *
 * Usage:
 *   const save = waitForSave(page);
 *   await saveDialog(page, /Risk/);
 *   await save;
 *   await page.reload();
 */
export function waitForSave(page: Page) {
  return page.waitForResponse(
    (r) => r.url().includes('reports.saveDraft') && r.status() === 200,
    { timeout: 10_000 },
  );
}

/** Navigate to /lead/report and wait for the form to hydrate. */
export async function gotoLeadReport(page: Page) {
  await page.goto('/lead/report');
  await page.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
  // Wait for the first accordion header — that means the byPeriod query resolved.
  await page.getByRole('button', { name: /Product Status/i }).first().waitFor({
    state: 'visible',
    timeout: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Stage popover
// ---------------------------------------------------------------------------

/**
 * Click a stage chip on the SDLC pipeline. The chip is identified by its
 * rendered status (`Dev: on-track`, `Dev: empty`, etc.) and product index
 * within the Product Status section.
 */
export async function clickStageChip(
  page: Page,
  productIndex: number,
  stage: StageName,
  status: 'on-track' | 'at-risk' | 'blocked' | 'empty',
): Promise<void> {
  const chips = page.locator(`button[aria-label="${stage}: ${status}"]`);
  await chips.nth(productIndex).click();
  await page.getByRole('dialog', { name: new RegExp(`Set status for ${stage}`) }).waitFor({
    state: 'visible',
    timeout: 5_000,
  });
}

export function stagePopover(page: Page): Locator {
  return page.getByRole('dialog', { name: /Set status for/ });
}

export async function selectStageOption(page: Page, option: StatusOption): Promise<void> {
  // Stage popover lives in a fixed-position portal. Playwright's
  // viewport heuristic still rejects clicks here even with force: true
  // because the actionability check fires before the click dispatch.
  // dispatchEvent skips actionability entirely — the button is a plain
  // <button onClick=…>, not a Radix Slot, so a synthetic click triggers
  // the React handler the same as a real one.
  const btn = stagePopover(page).getByRole('button', { name: new RegExp(option) });
  await btn.dispatchEvent('click');
}

export async function saveStagePopover(page: Page): Promise<void> {
  const btn = stagePopover(page).getByRole('button', { name: 'Save', exact: true });
  await btn.dispatchEvent('click');
  // Popover dismounts on Save. Do not assert on its absence here — sibling
  // confirmation prompts (e.g. Clear-with-linked-risk) wait for user input.
}

export async function cancelStagePopover(page: Page): Promise<void> {
  await stagePopover(page).getByRole('button', { name: 'Cancel', exact: true }).click();
}

// ---------------------------------------------------------------------------
// Item modal (Add / Edit)
// ---------------------------------------------------------------------------

/**
 * Open the Item edit dialog by clicking "+ Add" inside a product column.
 *
 * Both the Current Week and Next Week sections render a product column
 * with the same `Add item to <product>` aria-label, so we have to scope
 * by the parent accordion before letting Playwright resolve the click
 * target. Without the scope, getByRole errors on a strict-mode violation.
 */
export async function openItemAdd(
  page: Page,
  productName: string,
  week: 'current' | 'next' = 'current',
): Promise<void> {
  const sectionName = week === 'current' ? 'Current Week' : 'Next Week';
  // The section "header" is the accordion <button>; the panel sits as the
  // header's NEXT sibling. We can't pierce the role tree with `:has()`,
  // so use a structural locator: "the panel whose preceding header reads
  // <sectionName>".
  await page
    .locator(`[aria-expanded="true"]:has-text("${sectionName}") + div`)
    .getByRole('button', { name: `Add item to ${productName}` })
    .click();
  await itemDialog(page).waitFor({ state: 'visible', timeout: 5_000 });
}

/**
 * Open the Item edit dialog by clicking the pencil on an existing card.
 *
 * The action overlay sits inside a `pointer-events-none` wrapper that
 * only flips to `pointer-events-auto` on `:hover`. Without a hover the
 * card root captures every click and Playwright's hit-test refuses to
 * dispatch on the button. We `hover()` the card first to activate the
 * group-hover state, then dispatch the click.
 */
export async function openItemEdit(page: Page, cardText: string): Promise<void> {
  const card = page.getByTestId('item-card').filter({ hasText: cardText }).first();
  await card.hover();
  await card.getByRole('button', { name: 'Edit', exact: true }).click({ force: true });
  await itemDialog(page).waitFor({ state: 'visible', timeout: 5_000 });
}

/**
 * Delete an item card by clicking its trash icon. Same hover-then-click
 * dance as openItemEdit so the pointer-events:none overlay doesn't
 * intercept the dispatch.
 */
export async function deleteItem(page: Page, cardText: string): Promise<void> {
  const card = page.getByTestId('item-card').filter({ hasText: cardText }).first();
  await card.hover();
  await card.getByRole('button', { name: 'Delete', exact: true }).click({ force: true });
}

export function itemDialog(page: Page): Locator {
  return page.getByRole('dialog', { name: /Item/i });
}

export async function fillItemDialog(
  page: Page,
  fields: { text?: string; status?: ItemStatus; productName?: string },
): Promise<void> {
  if (fields.text !== undefined) {
    await itemDialog(page).getByLabel(/Description/i).fill(fields.text);
  }
  if (fields.status) {
    const label = {
      'in-progress': 'In Progress',
      completed: 'Completed',
      blocked: 'Blocked',
      planned: 'Planned',
    }[fields.status];
    await itemDialog(page).getByRole('button', { name: label }).click();
  }
  if (fields.productName) {
    await itemDialog(page).getByLabel(/Product/i).selectOption({ label: fields.productName });
  }
}

export async function saveDialog(page: Page, dialogName: RegExp = /dialog/i): Promise<void> {
  await page.getByRole('dialog', { name: dialogName }).getByRole('button', { name: 'Save' }).click();
}

export async function cancelDialog(page: Page, dialogName: RegExp = /dialog/i): Promise<void> {
  await page.getByRole('dialog', { name: dialogName }).getByRole('button', { name: /Cancel/ }).click();
}

// ---------------------------------------------------------------------------
// Accordion sections
// ---------------------------------------------------------------------------

const SECTION_NAMES = ['Product Status', 'Current Week', 'Next Week', 'Risks & Blockers', 'Decisions', 'Priorities'] as const;
export type SectionName = (typeof SECTION_NAMES)[number];

/** Expand a collapsed accordion section. No-op if already expanded. */
export async function expandSection(page: Page, name: SectionName): Promise<void> {
  const header = page.getByRole('button', { name: new RegExp(`^${name}`), exact: false }).first();
  const expanded = await header.getAttribute('aria-expanded');
  if (expanded !== 'true') {
    await header.click();
  }
}

// ---------------------------------------------------------------------------
// Assertions on the byPeriod state
// ---------------------------------------------------------------------------

/**
 * Assert the "Product Status" header advertises the expected number of
 * assigned products. After Clear+Save the row should NOT drop, so a
 * regression on the trafficLight-nullable fix would surface as a
 * decremented count here.
 */
export async function expectAssignedProducts(page: Page, count: number): Promise<void> {
  await expect(
    page.getByRole('button', { name: new RegExp(`${count} assigned products?`) }),
  ).toBeVisible();
}

/** Assert a Dev chip on the given product has the expected status. */
export async function expectStageStatus(
  page: Page,
  productIndex: number,
  stage: StageName,
  status: 'on-track' | 'at-risk' | 'blocked' | 'empty',
): Promise<void> {
  await expect(
    page.locator(`button[aria-label="${stage}: ${status}"]`).nth(productIndex),
  ).toBeVisible({ timeout: 5_000 });
}
