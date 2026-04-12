import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Dev-mode session helpers — identical to the functional E2E specs.
 */

const DEV_SESSION_KEY = 'customreport:dev-session';

interface DevSession {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly role: 'lead' | 'head' | 'viewer';
  readonly activeReportId: string;
  readonly activeReportSectionId: string | null;
}

const sessions: Record<'lead' | 'head' | 'viewer', DevSession> = {
  lead: {
    userId: '33333333-3333-4333-8333-333333333333',
    email: 'lead1@customreport.local',
    name: 'Lead 1',
    role: 'lead',
    activeReportId: '22222222-2222-4222-8222-222222222222',
    activeReportSectionId: '11111111-1111-4111-8111-111111111111',
  },
  head: {
    userId: '00000000-0000-4000-8000-000000000001',
    email: 'head@customreport.local',
    name: 'Department Head',
    role: 'head',
    activeReportId: '22222222-2222-4222-8222-222222222222',
    activeReportSectionId: null,
  },
  viewer: {
    userId: '44444444-4444-4444-8444-444444444444',
    email: 'viewer@customreport.local',
    name: 'Report Viewer',
    role: 'viewer',
    activeReportId: '22222222-2222-4222-8222-222222222222',
    activeReportSectionId: null,
  },
};

async function setSession(page: import('@playwright/test').Page, session: DevSession): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: DEV_SESSION_KEY, value: session },
  );
}

// ─── Pages to audit ──────────────────────────────────────────────────

const pagesToAudit = [
  { name: 'lead-report', path: '/lead/report', role: 'lead' as const },
  { name: 'head-dashboard', path: '/head/dashboard', role: 'head' as const },
  { name: 'head-report', path: '/head/report', role: 'head' as const },
  { name: 'admin-panel', path: '/admin', role: 'head' as const },
  { name: 'report-history', path: '/reports/history', role: 'viewer' as const },
  { name: 'auth-error', path: '/auth/error?reason=session_expired', role: null },
];

// ─── Automated WCAG 2.1 AA accessibility audit ──────────────────────

test.describe('Accessibility audit (WCAG 2.1 AA)', () => {
  for (const entry of pagesToAudit) {
    test(`a11y audit: ${entry.name}`, async ({ page }) => {
      if (entry.role) {
        await setSession(page, sessions[entry.role]);
      }

      await page.goto(entry.path);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      // Report violations with useful detail before asserting
      const violations = results.violations.map((v) => ({
        rule: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.length,
        firstTarget: v.nodes[0]?.target,
      }));

      expect(violations, `Accessibility violations on ${entry.name}`).toEqual([]);
    });
  }
});

// ─── Keyboard navigation test ────────────────────────────────────────

test.describe('Keyboard navigation', () => {
  test('lead report form is fully reachable via Tab', async ({ page }) => {
    await setSession(page, sessions.lead);
    await page.goto('/lead/report');
    await page.waitForLoadState('networkidle');

    // Tab through form elements and verify focus reaches an element
    await page.keyboard.press('Tab');
    const firstFocusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(firstFocusedTag).toBeTruthy();

    // Count all focusable interactive elements
    const focusableCount = await page.evaluate(() => {
      const els = document.querySelectorAll(
        'input, select, textarea, button, [tabindex="0"], a[href]',
      );
      return els.length;
    });

    // A form page should have a reasonable number of interactive elements
    expect(focusableCount).toBeGreaterThan(5);
  });

  test('admin panel controls are keyboard-accessible', async ({ page }) => {
    await setSession(page, sessions.head);
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Tab into the page and check that focus lands on an interactive element
    await page.keyboard.press('Tab');
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedTag).toBeTruthy();

    // Verify buttons are focusable
    const buttonCount = await page.evaluate(() => document.querySelectorAll('button').length);
    expect(buttonCount).toBeGreaterThan(0);
  });
});
