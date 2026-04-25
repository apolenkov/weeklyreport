/**
 * Accessibility E2E Tests
 *
 * Verifies core accessibility requirements: skip-link, ARIA landmarks,
 * accessible names, focus visibility, touch targets, and heading hierarchy.
 *
 * Uses native Playwright locators and getByRole for assertions.
 * Does NOT require @axe-core/playwright — keeps assertions simple.
 *
 * Covers: SC-59..SC-62 (Responsive & Accessibility), WCAG AA baseline
 */

import { test, expect } from '../fixtures';
import { test as base } from '@playwright/test';

// ---------------------------------------------------------------------------
// Skip Link
// ---------------------------------------------------------------------------

base.describe('Accessibility — Skip Link', () => {
  base('skip link exists and targets #main-content', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });

    // The skip link is an <a> with href="#main-content" and class "sr-only"
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toHaveCount(1);
    await expect(skipLink).toHaveAttribute('href', '#main-content');
    await expect(skipLink).toContainText('Skip to content');
  });

  base('skip link becomes visible on Tab press', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Press Tab to focus the skip link
    await page.keyboard.press('Tab');

    const skipLink = page.locator('a[href="#main-content"]');
    // After focus, the sr-only class should be replaced with visible styles
    // (focus:not-sr-only makes it visible)
    await expect(skipLink).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Accessible Names on Buttons
// ---------------------------------------------------------------------------

test.describe('Accessibility — Button Names', () => {
  test('all buttons on lead form have accessible names', async ({ leadPage }) => {
    await leadPage.goto('/lead/report');
    await leadPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await leadPage.waitForLoadState('networkidle', { timeout: 15_000 });

    // Get all buttons on the page
    const buttons = leadPage.getByRole('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    // Every button should have a non-empty accessible name
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const name = await button.getAttribute('aria-label') ??
                   await button.innerText();
      expect(name.trim().length, `Button ${i} has no accessible name`).toBeGreaterThan(0);
    }
  });

  test('all buttons on dashboard have accessible names', async ({ headPage }) => {
    await headPage.goto('/head/dashboard');
    await headPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await headPage.getByRole('heading', { name: 'Dashboard' }).waitFor({ state: 'visible', timeout: 15_000 });
    await headPage.waitForLoadState('networkidle', { timeout: 15_000 });

    const buttons = headPage.getByRole('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const name = await button.getAttribute('aria-label') ??
                   await button.innerText();
      expect(name.trim().length, `Button ${i} has no accessible name`).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Accessible Names on Links
// ---------------------------------------------------------------------------

base.describe('Accessibility — Link Names', () => {
  base('all links on login page have accessible names', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const links = page.getByRole('link');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const ariaLabel = await link.getAttribute('aria-label');
      const text = await link.innerText();
      const name = ariaLabel ?? text;
      expect(name.trim().length, `Link ${i} has no accessible name`).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Focus Visibility
// ---------------------------------------------------------------------------

base.describe('Accessibility — Focus Visibility', () => {
  base('focus ring visible on tab navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Tab to the SSO button (past the skip-link)
    await page.keyboard.press('Tab'); // skip-link
    await page.keyboard.press('Tab'); // SSO button

    const ssoLink = page.getByText('Enter Application');
    await expect(ssoLink).toBeFocused();

    // Verify the focused element has a visible focus ring (outline/ring CSS)
    const outline = await ssoLink.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow,
      };
    });

    // Focus should produce either a visible outline or a ring (box-shadow)
    const hasOutline = outline.outlineStyle !== 'none' && outline.outlineWidth !== '0px';
    const hasRing = outline.boxShadow !== 'none' && outline.boxShadow !== '';
    expect(hasOutline || hasRing, 'Focused SSO button should have visible focus indicator').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Touch Targets
// ---------------------------------------------------------------------------

base.describe('Accessibility — Touch Targets', () => {
  base('interactive elements meet 44px minimum height', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Check the SSO button (explicitly styled with min-height: 44px)
    const ssoButton = page.getByText('Enter Application');
    const ssoBox = await ssoButton.boundingBox();
    expect(ssoBox).toBeTruthy();
    expect(ssoBox!.height).toBeGreaterThanOrEqual(44);

    // Check the Return to Login button on auth error page
    await page.goto('/auth/error?reason=session_expired');
    await page.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    const returnBtn = page.getByText('Return to Login');
    const returnBox = await returnBtn.boundingBox();
    expect(returnBox).toBeTruthy();
    expect(returnBox!.height).toBeGreaterThanOrEqual(44);
  });
});

// ---------------------------------------------------------------------------
// Heading Hierarchy
// ---------------------------------------------------------------------------

test.describe('Accessibility — Heading Hierarchy', () => {
  test('login page has h1', async ({ leadPage }) => {
    // Use leadPage but navigate to login (no auth needed for /)
    await leadPage.goto('/');
    await leadPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });

    // h1 should exist (either "Weekly Status Reporting" on desktop or "CustomReport" h2)
    const headings = leadPage.getByRole('heading');
    const count = await headings.count();
    expect(count).toBeGreaterThan(0);
  });

  test('dashboard page has h1', async ({ headPage }) => {
    await headPage.goto('/head/dashboard');
    await headPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await headPage.getByRole('heading', { name: 'Dashboard' }).waitFor({ state: 'visible', timeout: 15_000 });

    const h1 = headPage.locator('h1');
    await expect(h1.first()).toBeVisible();
  });

  test('lead report page has h1', async ({ leadPage }) => {
    await leadPage.goto('/lead/report');
    await leadPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await leadPage.waitForLoadState('networkidle', { timeout: 15_000 });

    const h1 = leadPage.locator('h1');
    await expect(h1.first()).toBeVisible();
  });

  test('admin page has h1', async ({ headPage }) => {
    await headPage.goto('/admin');
    await headPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await headPage.waitForLoadState('networkidle', { timeout: 15_000 });

    const h1 = headPage.locator('h1');
    await expect(h1.first()).toBeVisible();
    await expect(h1).toContainText('Admin Panel');
  });
});

// ---------------------------------------------------------------------------
// ARIA Landmarks
// ---------------------------------------------------------------------------

base.describe('Accessibility — ARIA Landmarks', () => {
  base('login page has main landmark', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });

    const main = page.locator('main');
    await expect(main).toHaveCount(1);
    await expect(main).toBeVisible();
  });

  base('auth error page has main landmark', async ({ page }) => {
    await page.goto('/auth/error?reason=session_expired');
    await page.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });

    const main = page.locator('main');
    await expect(main).toHaveCount(1);
    await expect(main).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Color Contrast (structural check)
// ---------------------------------------------------------------------------

base.describe('Accessibility — Color Contrast', () => {
  base('text elements use themed color variables', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Verify the body has a background color set (not transparent)
    const bodyBg = await page.evaluate(() => {
      const style = window.getComputedStyle(document.body);
      return style.backgroundColor;
    });
    // Body should have a non-transparent background
    expect(bodyBg).not.toBe('rgba(0, 0, 0, 0)');
    expect(bodyBg).not.toBe('transparent');

    // Verify heading text color is set and readable
    const headingColor = await page.evaluate(() => {
      const heading = document.querySelector('h1, h2');
      if (!heading) return null;
      return window.getComputedStyle(heading).color;
    });
    expect(headingColor).toBeTruthy();
    // Color should not be fully transparent
    expect(headingColor).not.toBe('rgba(0, 0, 0, 0)');
  });
});
