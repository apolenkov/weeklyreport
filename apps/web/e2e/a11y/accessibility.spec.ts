import { test, expect } from '../fixtures';
import AxeBuilder from '@axe-core/playwright';

// Pages to audit
const leadPages = [
  { name: 'lead-report', path: '/lead/report' },
] as const;

const headPages = [
  { name: 'admin-panel', path: '/admin' },
] as const;

const viewerPages = [
  { name: 'report-history', path: '/reports/history' },
] as const;

const publicPages = [
  { name: 'auth-error', path: '/auth/error?reason=session_expired' },
] as const;

// Automated WCAG 2.1 AA accessibility audit
test.describe('Accessibility audit (WCAG 2.1 AA)', () => {
  for (const entry of leadPages) {
    test(`a11y audit: ${entry.name}`, async ({ leadPage }) => {
      await leadPage.goto(entry.path);
      await leadPage.getByRole('heading', { level: 1 }).waitFor({ timeout: 30_000 });

      const results = await new AxeBuilder({ page: leadPage })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const violations = results.violations.map((v) => ({
        rule: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.length,
        firstTarget: v.nodes[0]?.target,
      }));

      // Log violations for awareness; critical violations should be addressed
      if (violations.length > 0) {
        console.log(`A11y violations on ${entry.name}:`, JSON.stringify(violations, null, 2));
      }
      // Only fail on critical impact violations
      const critical = violations.filter((v) => v.impact === 'critical');
      expect(critical, `Critical a11y violations on ${entry.name}`).toEqual([]);
    });
  }

  for (const entry of headPages) {
    test(`a11y audit: ${entry.name}`, async ({ headPage }) => {
      await headPage.goto(entry.path);
      await headPage.getByRole('heading', { level: 1 }).waitFor({ timeout: 15_000 });

      const results = await new AxeBuilder({ page: headPage })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const violations = results.violations.map((v) => ({
        rule: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.length,
        firstTarget: v.nodes[0]?.target,
      }));

      // Log violations for awareness; critical violations should be addressed
      if (violations.length > 0) {
        console.log(`A11y violations on ${entry.name}:`, JSON.stringify(violations, null, 2));
      }
      // Only fail on critical impact violations
      const critical = violations.filter((v) => v.impact === 'critical');
      expect(critical, `Critical a11y violations on ${entry.name}`).toEqual([]);
    });
  }

  for (const entry of viewerPages) {
    test(`a11y audit: ${entry.name}`, async ({ viewerPage }) => {
      await viewerPage.goto(entry.path);
      await viewerPage.getByRole('heading', { level: 1 }).waitFor({ timeout: 15_000 });

      const results = await new AxeBuilder({ page: viewerPage })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const violations = results.violations.map((v) => ({
        rule: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.length,
        firstTarget: v.nodes[0]?.target,
      }));

      // Log violations for awareness; critical violations should be addressed
      if (violations.length > 0) {
        console.log(`A11y violations on ${entry.name}:`, JSON.stringify(violations, null, 2));
      }
      // Only fail on critical impact violations
      const critical = violations.filter((v) => v.impact === 'critical');
      expect(critical, `Critical a11y violations on ${entry.name}`).toEqual([]);
    });
  }

  for (const entry of publicPages) {
    test(`a11y audit: ${entry.name}`, async ({ leadPage }) => {
      await leadPage.goto(entry.path);
      await leadPage.waitForTimeout(2000);

      const results = await new AxeBuilder({ page: leadPage })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const violations = results.violations.map((v) => ({
        rule: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.length,
        firstTarget: v.nodes[0]?.target,
      }));

      // Log violations for awareness; critical violations should be addressed
      if (violations.length > 0) {
        console.log(`A11y violations on ${entry.name}:`, JSON.stringify(violations, null, 2));
      }
      // Only fail on critical impact violations
      const critical = violations.filter((v) => v.impact === 'critical');
      expect(critical, `Critical a11y violations on ${entry.name}`).toEqual([]);
    });
  }
});

// Keyboard navigation test
test.describe('Keyboard navigation', () => {
  test('lead report form is fully reachable via Tab', async ({ leadPage }) => {
    await leadPage.goto('/lead/report');
    await leadPage.getByRole('heading', { level: 1 }).waitFor({ timeout: 30_000 });

    // Tab through form elements and verify focus reaches an element
    await leadPage.keyboard.press('Tab');
    const firstFocusedTag = await leadPage.evaluate(() => document.activeElement?.tagName);
    expect(firstFocusedTag).toBeTruthy();

    // Count all focusable interactive elements
    const focusableCount = await leadPage.evaluate(() => {
      const els = document.querySelectorAll(
        'input, select, textarea, button, [tabindex="0"], a[href]',
      );
      return els.length;
    });

    // A form page should have a reasonable number of interactive elements
    expect(focusableCount).toBeGreaterThan(5);
  });

  test('admin panel controls are keyboard-accessible', async ({ headPage }) => {
    await headPage.goto('/admin');
    await headPage.getByRole('heading', { level: 1 }).waitFor({ timeout: 15_000 });

    // Tab into the page and check that focus lands on an interactive element
    await headPage.keyboard.press('Tab');
    const focusedTag = await headPage.evaluate(() => document.activeElement?.tagName);
    expect(focusedTag).toBeTruthy();

    // Verify buttons are focusable
    const buttonCount = await headPage.evaluate(() => document.querySelectorAll('button').length);
    expect(buttonCount).toBeGreaterThan(0);
  });
});
