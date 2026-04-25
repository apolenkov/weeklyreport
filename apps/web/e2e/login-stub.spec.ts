/**
 * Login Page — Dev Mode Stub E2E Tests
 *
 * Validates the login page behavior when NEXT_PUBLIC_AUTH_STUB=true:
 * role selection buttons, redirects for each role, SSO button state,
 * and switching roles (requires re-login).
 *
 * The playwright config sets AUTH_DEV_MODE=true for the webServer,
 * and the login page checks NEXT_PUBLIC_AUTH_STUB at build time.
 * These tests use a fresh page (no stored auth) to verify login UI.
 *
 * Covers: SC-290..SC-297
 */

import { test as base, expect, type Page } from '@playwright/test';

// Use a plain page (no auth state) for login tests
const test = base.extend<{ freshPage: Page }>({
  freshPage: async ({ browser }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
});

// ---------------------------------------------------------------------------
// SC-290: Login page shows role selection buttons in dev mode
// ---------------------------------------------------------------------------

test.describe('SC-290: Login shows role buttons in dev mode', () => {
  test('SC-290: Login page shows role selection buttons in dev mode', async ({ freshPage }) => {
    await freshPage.goto('/');
    await freshPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });

    // "Enter Application" main button should be visible
    await expect(freshPage.getByText('Enter Application')).toBeVisible();

    // "or select role" divider should be visible
    await expect(freshPage.getByText('or select role')).toBeVisible();

    // All 4 role buttons
    await expect(freshPage.getByText('Enter as Lead')).toBeVisible();
    await expect(freshPage.getByText('Enter as Head')).toBeVisible();
    await expect(freshPage.getByText('Enter as Admin')).toBeVisible();
    await expect(freshPage.getByText('Enter as Viewer')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// SC-291: Click "Enter as Lead" redirects to /report
// ---------------------------------------------------------------------------

test.describe('SC-291: Lead role redirect', () => {
  test('SC-291: Click "Enter as Lead" redirects to /lead/report', async ({ freshPage }) => {
    await freshPage.goto('/');
    await freshPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });

    const leadLink = freshPage.getByText('Enter as Lead');
    await expect(leadLink).toBeVisible();

    // Verify the href points to /lead/report
    await expect(leadLink).toHaveAttribute('href', '/lead/report');

    // Click and verify navigation
    await leadLink.click();
    await freshPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    expect(freshPage.url()).toContain('/lead/report');
  });
});

// ---------------------------------------------------------------------------
// SC-292: Click "Enter as Head" redirects to /dashboard
// ---------------------------------------------------------------------------

test.describe('SC-292: Head role redirect', () => {
  test('SC-292: Click "Enter as Head" redirects to /head/dashboard', async ({ freshPage }) => {
    await freshPage.goto('/');
    await freshPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });

    const headLink = freshPage.getByText('Enter as Head');
    await expect(headLink).toBeVisible();
    await expect(headLink).toHaveAttribute('href', '/head/dashboard');

    await headLink.click();
    await freshPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    expect(freshPage.url()).toContain('/head/dashboard');
  });
});

// ---------------------------------------------------------------------------
// SC-293: Click "Enter as Admin" redirects to /admin
// ---------------------------------------------------------------------------

test.describe('SC-293: Admin role redirect', () => {
  test('SC-293: Click "Enter as Admin" redirects to /admin', async ({ freshPage }) => {
    await freshPage.goto('/');
    await freshPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });

    const adminLink = freshPage.getByText('Enter as Admin');
    await expect(adminLink).toBeVisible();
    await expect(adminLink).toHaveAttribute('href', '/admin');

    await adminLink.click();
    await freshPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    expect(freshPage.url()).toContain('/admin');
  });
});

// ---------------------------------------------------------------------------
// SC-294: Click "Enter as Viewer" redirects to /reports/history
// ---------------------------------------------------------------------------

test.describe('SC-294: Viewer role redirect', () => {
  test('SC-294: Click "Enter as Viewer" redirects to /reports/history (read-only)', async ({ freshPage }) => {
    await freshPage.goto('/');
    await freshPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });

    const viewerLink = freshPage.getByText('Enter as Viewer');
    await expect(viewerLink).toBeVisible();
    await expect(viewerLink).toHaveAttribute('href', '/reports/history');

    await viewerLink.click();
    await freshPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    expect(freshPage.url()).toContain('/reports/history');
  });
});

// ---------------------------------------------------------------------------
// SC-295: SSO button disabled / replaced in dev mode
// ---------------------------------------------------------------------------

test.describe('SC-295: SSO disabled in dev mode', () => {
  test('SC-295: SSO "Sign in with SSO" button is NOT shown in dev mode', async ({ freshPage }) => {
    await freshPage.goto('/');
    await freshPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });

    // In AUTH_STUB mode, "Sign in with SSO" button is replaced by "Enter Application"
    await expect(freshPage.getByText('Enter Application')).toBeVisible();
    await expect(freshPage.getByRole('button', { name: 'Sign in with corporate SSO' })).not.toBeVisible();
  });

  test('SC-295: "Enter Application" link navigates to /head/dashboard', async ({ freshPage }) => {
    await freshPage.goto('/');
    await freshPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });

    const enterLink = freshPage.getByText('Enter Application');
    await expect(enterLink).toHaveAttribute('href', '/head/dashboard');
  });
});

// ---------------------------------------------------------------------------
// SC-296: Login stub disabled in production mode
// (Cannot fully test production mode in E2E since the test env always has
//  AUTH_DEV_MODE=true. Instead, verify that the page structure in dev mode
//  is consistent -- the stub roles are present.)
// ---------------------------------------------------------------------------

test.describe('SC-296: Dev mode login structure', () => {
  test('SC-296: login page in dev mode has role grid layout (2x2)', async ({ freshPage }) => {
    await freshPage.goto('/');
    await freshPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });

    // The role buttons are rendered in a grid -- all 4 should be present as links
    const roleLinks = freshPage.locator('a').filter({ hasText: /Enter as/ });
    await expect(roleLinks).toHaveCount(4);
  });

  test('SC-296: login page still shows Keycloak/SAML footer info', async ({ freshPage }) => {
    await freshPage.goto('/');
    await freshPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });

    // Footer info should still be visible regardless of auth mode
    await expect(freshPage.getByText('Keycloak')).toBeVisible();
    await expect(freshPage.getByText('SAML 2.0')).toBeVisible();
    await expect(freshPage.getByText('Corporate SSO')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// SC-297: Switching roles requires re-login
// (In stub mode, switching roles means navigating back to / and picking
//  a different role. Test that navigating to / from a role page works.)
// ---------------------------------------------------------------------------

test.describe('SC-297: Switching roles via re-login', () => {
  test('SC-297: navigating to / after entering as Lead shows login with role buttons', async ({ freshPage }) => {
    // Enter as Lead first
    await freshPage.goto('/');
    await freshPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await freshPage.getByText('Enter as Lead').click();
    await freshPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    expect(freshPage.url()).toContain('/lead/report');

    // Navigate back to login
    await freshPage.goto('/');
    await freshPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });

    // All role buttons should still be available
    await expect(freshPage.getByText('Enter as Lead')).toBeVisible();
    await expect(freshPage.getByText('Enter as Head')).toBeVisible();
    await expect(freshPage.getByText('Enter as Admin')).toBeVisible();
    await expect(freshPage.getByText('Enter as Viewer')).toBeVisible();
  });

  test('SC-297: can switch from Lead to Admin by going back to login', async ({ freshPage }) => {
    // Enter as Lead
    await freshPage.goto('/');
    await freshPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await freshPage.getByText('Enter as Lead').click();
    await freshPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    expect(freshPage.url()).toContain('/lead/report');

    // Go back to login and switch to Admin
    await freshPage.goto('/');
    await freshPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await freshPage.getByText('Enter as Admin').click();
    await freshPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    expect(freshPage.url()).toContain('/admin');
  });
});
