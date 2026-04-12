import { expect, test } from '@playwright/test';

/**
 * Session setup helpers for dev-mode auth.
 * In non-production mode the middleware passes through all requests,
 * so setting localStorage is sufficient for the app to recognise
 * the user. The same pattern is used by the functional E2E specs.
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

// ─── Pages to capture ────────────────────────────────────────────────

const pages = [
  { name: 'landing', path: '/', role: null },
  { name: 'lead-report', path: '/lead/report', role: 'lead' as const },
  { name: 'head-dashboard', path: '/head/dashboard', role: 'head' as const },
  { name: 'head-report', path: '/head/report', role: 'head' as const },
  { name: 'admin-panel', path: '/admin', role: 'head' as const },
  { name: 'report-history', path: '/reports/history', role: 'viewer' as const },
  { name: 'auth-error-expired', path: '/auth/error?reason=session_expired', role: null },
  { name: 'auth-error-forbidden', path: '/auth/error?reason=forbidden', role: null },
] as const;

// ─── Visual regression tests ─────────────────────────────────────────

test.describe('Visual regression screenshots', () => {
  for (const entry of pages) {
    test(`screenshot: ${entry.name}`, async ({ page }) => {
      if (entry.role) {
        await setSession(page, sessions[entry.role]);
      }

      await page.goto(entry.path);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot(`${entry.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
});
