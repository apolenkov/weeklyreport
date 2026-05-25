/**
 * CLS re-trace 2026-05-23 — one-off headless script, not part of the test suite.
 * Measures Cumulative Layout Shift on /head/dashboard and /lead/report after
 * DashboardSkeleton geometry hardening (commit 3f4cb01).
 * Run: pnpm exec tsx apps/web/e2e/scripts/cls-retrace.ts
 */
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const VIEWPORT = { width: 1728, height: 900 };

async function measureCLS(
  url: string,
  cookieValue: string,
): Promise<number> {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VIEWPORT });

  await ctx.addCookies([{
    name: "customreport_session",
    value: cookieValue,
    domain: "localhost",
    path: "/",
  }]);

  const page = await ctx.newPage();

  let cls = 0;
  await page.addInitScript(() => {
    (window as unknown as { __CLS__: number }).__CLS__ = 0;
    const po = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const le = e as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
        if (!le.hadRecentInput && le.value != null) {
          (window as unknown as { __CLS__: number }).__CLS__ += le.value;
        }
      }
    });
    po.observe({ type: "layout-shift", buffered: true });
  });

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  cls = await page.evaluate(() => (window as unknown as { __CLS__: number }).__CLS__);
  await browser.close();
  return Math.round(cls * 10000) / 10000;
}

async function getSessionCookie(role: "head" | "lead"): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  const resp = await page.request.get(
    `${BASE}/auth/dev-login?role=${role}&redirect=/`,
    { maxRedirects: 0 },
  );
  if (resp.status() !== 302 && resp.status() !== 303) {
    throw new Error(`dev-login returned ${resp.status()}`);
  }

  const cookies = await ctx.cookies();
  const session = cookies.find((c) => c.name === "customreport_session");
  await browser.close();
  if (!session) throw new Error("no session cookie after dev-login");
  return session.value;
}

async function main() {
  console.log("CLS re-trace 2026-05-23 — viewport 1728x900");
  console.log("─".repeat(50));

  const headCookie = await getSessionCookie("head");
  const leadCookie = await getSessionCookie("lead");

  const dashCLS = await measureCLS(`${BASE}/head/dashboard`, headCookie);
  const leadCLS = await measureCLS(`${BASE}/lead/report`, leadCookie);

  console.log(`/head/dashboard  CLS ${dashCLS.toFixed(4)}`);
  console.log(`/lead/report     CLS ${leadCLS.toFixed(4)}`);
  console.log("─".repeat(50));

  const baseline = 0.0817;
  const improved = dashCLS < baseline - 0.001;
  console.log(improved
    ? `Dashboard: improved from ${baseline} → ${dashCLS.toFixed(4)}`
    : `Dashboard: no improvement (${dashCLS.toFixed(4)} vs baseline ${baseline})`
  );
}

main().catch((err) => { console.error(err); process.exit(1); });
