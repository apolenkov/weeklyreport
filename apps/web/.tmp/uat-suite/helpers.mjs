// Shared helpers for UAT suite — headless playwright + screenshots + db queries
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

export const BASE = "http://localhost:3000";
export const API = "http://localhost:3002";
export const MAILHOG = "http://localhost:8025";
export const SCREENSHOTS_DIR =
  "/home/user/work/customreport/apps/web/.tmp/uat-screenshots";

mkdirSync(SCREENSHOTS_DIR, { recursive: true });

// Stream protocol — one line per outcome → Monitor surfaces in chat
export function emit(id, status, msg, detail = "") {
  const icon =
    status === "PASS"
      ? "✓"
      : status === "FAIL"
        ? "✗"
        : status === "WARN"
          ? "⚠"
          : "·";
  const line = `${icon} ${id} [${status}] ${msg}${detail ? ` — ${detail.slice(0, 200)}` : ""}`;
  process.stdout.write(line + "\n");
}
export const pass = (id, msg, detail = "") => emit(id, "PASS", msg, detail);
export const fail = (id, msg, detail = "") => emit(id, "FAIL", msg, detail);
export const warn = (id, msg, detail = "") => emit(id, "WARN", msg, detail);
export const note = (msg) => process.stdout.write(`· ${msg}\n`);

// Wait for the React app to hydrate AND finish first-data render.
// Next.js dev mode lazy-compiles each route on first hit, so networkidle
// fires before tRPC queries settle. Phase 33-04 hardening: explicit
// per-route ready signal, not just chrome presence.
//
//   - 'lead-form'   — h1 "My Report" + "Editing version" text
//   - 'dashboard'   — h1 "Dashboard" + "Submissions" or "Last week"
//   - 'weekly'      — h1 "Weekly Report" + "Toggle All"
//   - 'admin'       — "Admin Panel" + visible tab strip
//   - 'history'     — h1 "My History" or "Published" + at least one card
//   - 'archive'     — h1 "Published Reports" or "Archive" + at least one card
//   - 'trends'      — "Trends" + "history" or "velocity" text
//   - 'forbidden'   — "Page unavailable" copy
//   - 'auto' (default) — checks any of: [aria-expanded], main#main-content,
//                         DEV switcher, or "Page unavailable" forbidden state.
// All variants fall through silently on timeout — caller still sees whatever
// rendered, but assertions become much less flaky.
export async function waitForAppReady(page, timeoutOrKind = 15000, kindArg) {
  const kind =
    typeof timeoutOrKind === "string" ? timeoutOrKind : (kindArg ?? "auto");
  const timeout = typeof timeoutOrKind === "number" ? timeoutOrKind : 15000;
  await page.waitForLoadState("networkidle", { timeout }).catch(() => {});
  const checker = (() => {
    switch (kind) {
      case "lead-form":
        return () =>
          document.querySelector("h1") !== null &&
          (document.body.innerText.includes("Editing version") ||
            document.body.innerText.includes("Page unavailable"));
      case "dashboard":
        return () =>
          document.body.innerText.includes("Dashboard") &&
          (document.body.innerText.includes("Submissions") ||
            document.body.innerText.includes("Last week") ||
            document.body.innerText.includes("Page unavailable"));
      case "weekly":
        return () =>
          document.body.innerText.includes("Weekly Report") &&
          (document.body.innerText.includes("Toggle All") ||
            document.body.innerText.includes("Page unavailable"));
      case "admin":
        return () =>
          document.body.innerText.includes("Admin Panel") ||
          document.body.innerText.includes("Page unavailable");
      case "history":
        return () =>
          /(My History|Published reports)/.test(document.body.innerText) &&
          (document.querySelectorAll('a[href*="/lead/report"]').length > 0 ||
            document.querySelectorAll('a[href*="/reports/"]').length > 0 ||
            document.body.innerText.includes("No past submissions") ||
            document.body.innerText.includes("Page unavailable"));
      case "archive":
        return () =>
          /(Published reports|Archive)/i.test(document.body.innerText);
      case "trends":
        return () =>
          document.body.innerText.includes("Trends") &&
          (document.body.innerText.includes("history") ||
            document.body.innerText.includes("velocity") ||
            document.body.innerText.includes("Page unavailable"));
      case "forbidden":
        return () => document.body.innerText.includes("Page unavailable");
      case "auto":
      default:
        return () =>
          document.querySelectorAll("[aria-expanded]").length > 0 ||
          document.querySelectorAll('[data-testid="hydrated"]').length > 0 ||
          document.querySelectorAll("main#main-content").length > 0 ||
          document.body.innerText.includes("DEV: switch role") ||
          document.body.innerText.includes("Page unavailable") ||
          document.body.innerText.includes("Access denied");
    }
  })();
  await page
    .waitForFunction(checker, undefined, { timeout, polling: 200 })
    .catch(() => {});
}

export async function loginAs(page, role, email) {
  const url = email
    ? `${BASE}/auth/dev-login?role=${role}&email=${email}`
    : `${BASE}/auth/dev-login?role=${role}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  // dev-login redirects to a role-appropriate landing page; wait for that
  // landing page to fully hydrate so subsequent assertions don't race the
  // first compile in dev mode.
  await waitForAppReady(page);
}

// Capture a page screenshot. Always waits for hydration first so dev-mode
// lazy compile doesn't produce blank captures.
export async function shot(
  page,
  id,
  opts = { waitFor: true, fullPage: false },
) {
  if (opts.waitFor !== false) {
    await waitForAppReady(page, 8000);
  }
  await page.screenshot({
    path: `${SCREENSHOTS_DIR}/${id}.png`,
    fullPage: opts.fullPage ?? false,
  });
}

// Read body innerText including portal-rendered toasts/dialogs.
// Sonner renders toasts via createPortal to <body>; textContent('body')
// works but can miss display:contents wrappers — innerText is the
// reliable choice.
export async function bodyText(page) {
  return page.evaluate(() => document.body.innerText);
}

// Click every collapsed accordion trigger so subsequent locators (+ Add
// Item, + Add Risk, + Add Priority, etc.) become visible.
//
// Pitfall avoided: lead-form's mount effects auto-expand certain sections.
// Earlier passes raced that effect and clicked on a row that was *about to
// open*, toggling it closed. We now wait for the expanded count to stabilize
// before probing — once the auto-expansion is done, only user-collapsed rows
// remain and clicking those is deterministic.
export async function expandAllAccordions(page) {
  // Settle: wait until [aria-expanded] count has been stable for ~400ms.
  let lastCount = -1;
  let stableSince = 0;
  for (let i = 0; i < 30; i++) {
    const cnt = await page.locator('[aria-expanded="true"]').count();
    if (cnt === lastCount) {
      stableSince += 100;
      if (stableSince >= 400) break;
    } else {
      stableSince = 0;
      lastCount = cnt;
    }
    await page.waitForTimeout(100);
  }
  // Now click whatever's still collapsed.
  const triggers = await page.$$('button[aria-expanded="false"]');
  for (const t of triggers) {
    await t.click({ force: true }).catch(() => {});
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(300);
}

// Query Postgres dev container — returns trimmed text or 'ERROR: ...'
export function pgQuery(sql) {
  try {
    return execSync(
      `docker exec customreport-postgres-1 psql -U customreport -d customreport -tAc "${sql.replace(/"/g, '\\"')}"`,
      { encoding: "utf8" },
    ).trim();
  } catch (e) {
    return `ERROR: ${e.message.slice(0, 200)}`;
  }
}

export function pgInt(sql) {
  const v = pgQuery(sql);
  if (v.startsWith("ERROR")) return -1;
  return parseInt(v, 10) || 0;
}

// Wrap a test body so a thrown error becomes FAIL with the message.
// Skip-throw-protocol: throw 0 to short-circuit cleanly inside a try block.
export async function runTest(id, fn) {
  try {
    await fn();
  } catch (e) {
    if (e !== 0)
      fail(id, "Exception: " + (e?.message ?? String(e)).slice(0, 200));
  }
}

export function attachConsoleErrors(page) {
  const errs = [];
  page.on("pageerror", (e) =>
    errs.push(`pageerror: ${e.message.slice(0, 150)}`),
  );
  page.on("console", (m) => {
    if (m.type() === "error")
      errs.push(`console.error: ${m.text().slice(0, 150)}`);
  });
  return errs;
}

// Seed accounts (per CLAUDE.md memory + .planning/memory/)
export const ACCOUNTS = {
  head: { role: "head", email: "head@customreport.local" },
  admin: { role: "admin", email: undefined }, // dev-login synthesizes admin@customreport.local
  viewer: { role: "viewer", email: undefined },
  olga: { role: "lead", email: "olga@customreport.local" }, // Week 16 draft
  platanov: { role: "lead", email: "platanov@customreport.local" }, // Week 16 submitted
  sergey: { role: "lead", email: "sergey@customreport.local" }, // Week 16 draft
};
