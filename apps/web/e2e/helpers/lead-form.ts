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
  const symbol = { 'On Track': '✓', 'At Risk': '!', Blocked: '✕', Clear: '○' }[option];
  await stagePopover(page).getByRole('button', { name: `${symbol} ${option}` }).click();
}

export async function saveStagePopover(page: Page): Promise<void> {
  await stagePopover(page).getByRole('button', { name: 'Save', exact: true }).click();
  // Popover dismounts on Save. Do not assert on its absence here — sibling
  // confirmation prompts (e.g. Clear-with-linked-risk) wait for user input.
}

export async function cancelStagePopover(page: Page): Promise<void> {
  await stagePopover(page).getByRole('button', { name: 'Cancel', exact: true }).click();
}

// ---------------------------------------------------------------------------
// Item modal (Add / Edit)
// ---------------------------------------------------------------------------

/** Open the Item edit dialog by clicking "+ Add" inside a product column. */
export async function openItemAdd(page: Page, productName: string): Promise<void> {
  await page.getByRole('button', { name: `Add item to ${productName}` }).click();
  await itemDialog(page).waitFor({ state: 'visible', timeout: 5_000 });
}

/** Open the Item edit dialog by clicking the pencil on an existing card. */
export async function openItemEdit(page: Page, cardText: string): Promise<void> {
  // Cards expose pencil/trash buttons inside a hover overlay; the buttons
  // are still in DOM (only opacity:0), so .click() works without hovering.
  const card = page.locator('div', { hasText: cardText }).filter({
    has: page.getByRole('button', { name: 'Edit' }),
  }).first();
  await card.getByRole('button', { name: 'Edit' }).click();
  await itemDialog(page).waitFor({ state: 'visible', timeout: 5_000 });
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
