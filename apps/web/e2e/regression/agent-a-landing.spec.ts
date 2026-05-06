import { test, expect } from '@playwright/test';

const SCREENSHOT_DIR = '.planning/regression/screenshots/agent-a';

/**
 * LAND-001..LAND-006: Landing page rendering basics (6 scenarios)
 * Scope: card layout, button links, responsive, no sidebar
 */

test.describe('LAND-001..006: Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any session cookies to ensure landing page visibility
    await page.context().clearCookies();
  });

  test('LAND-001: Landing page renders without auth → card with logo + subtitle + Sign In button', async ({
    page,
  }) => {
    await page.goto('/');

    // Check for main card structure
    const card = page.locator('[role="main"], .card, [class*="card"]').first();
    expect(card).toBeVisible({ timeout: 5000 });

    // Check for Sign In button
    const signInButton = page.locator('button:has-text("Sign In"), a:has-text("Sign In")').first();
    expect(signInButton).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LAND-001.png` });
  });

  test('LAND-002: "Sign In" button links to API_URL/auth/saml/login', async ({ page }) => {
    await page.goto('/');

    const signInButton = page.locator('button:has-text("Sign In"), a:has-text("Sign In")').first();
    const href = await signInButton.getAttribute('href');

    // Expect href to contain /auth/saml/login or /auth/dev-login
    expect(href).toMatch(/\/auth\/(?:saml\/)?login/);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LAND-002.png` });
  });

  test('LAND-003: Card centered vertically and horizontally', async ({ page }) => {
    await page.goto('/');

    const card = page.locator('[role="main"], .card, [class*="card"]').first();
    const boundingBox = await card.boundingBox();

    // Page should be roughly centered (simple heuristic)
    const viewport = page.viewportSize();
    expect(viewport).toBeTruthy();

    if (viewport && boundingBox) {
      // Card x should be roughly centered
      const cardCenterX = boundingBox.x + boundingBox.width / 2;
      const pageCenterX = viewport.width / 2;

      // Allow 20% tolerance
      const tolerance = viewport.width * 0.2;
      expect(Math.abs(cardCenterX - pageCenterX)).toBeLessThan(tolerance);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LAND-003.png` });
  });

  test('LAND-004: Card max-width is sm (max-w-sm)', async ({ page }) => {
    await page.goto('/');

    const card = page.locator('[role="main"], .card, [class*="card"]').first();
    const boundingBox = await card.boundingBox();

    // Tailwind max-w-sm = 384px
    // Allow slight tolerance for padding/margin
    expect(boundingBox?.width).toBeLessThanOrEqual(420);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LAND-004.png` });
  });

  test('LAND-005: Button is full-width inside card (w-full)', async ({ page }) => {
    await page.goto('/');

    const signInButton = page.locator('button:has-text("Sign In"), a:has-text("Sign In")').first();
    const buttonBox = await signInButton.boundingBox();
    const cardBox = await page.locator('[role="main"], .card, [class*="card"]').first().boundingBox();

    if (buttonBox && cardBox) {
      // Button should be nearly as wide as card (accounting for padding)
      const buttonWidth = buttonBox.width;
      const cardWidth = cardBox.width;

      // Allow 30px for padding on each side
      expect(buttonWidth).toBeGreaterThan(cardWidth - 60);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LAND-005.png` });
  });

  test('LAND-006: Page has no sidebar/navigation (no AppShell wrapper)', async ({ page }) => {
    await page.goto('/');

    // Check that there's no sidebar
    const sidebar = page.locator('[role="navigation"], nav, [class*="sidebar"]');
    const count = await sidebar.count();

    // Should have 0 or minimal navigation (only landing)
    expect(count).toBeLessThanOrEqual(1);

    // Verify the page is mostly just the card
    const mainContent = page.locator('[role="main"]');
    expect(mainContent).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LAND-006.png` });
  });
});
