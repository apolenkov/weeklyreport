// Minimal helpers for the tracked uat-suite scripts. Headless-only.
// Larger probe-helpers from apps/web/.tmp/uat-suite/ are NOT mirrored here —
// the tracked scripts are intentionally lightweight so CI can run them.

import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, "../../..");

export const BASE = process.env.UAT_BASE_URL ?? "http://localhost:3000";

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

export const note = (msg) => process.stdout.write(`· ${msg}\n`);

export async function loginAs(page, role, email) {
  const url = email
    ? `${BASE}/auth/dev-login?role=${role}&email=${encodeURIComponent(email)}`
    : `${BASE}/auth/dev-login?role=${role}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  await waitForAppReady(page);
}

export async function waitForAppReady(page, timeoutOrKind = 12000, kindArg) {
  const kind =
    typeof timeoutOrKind === "string" ? timeoutOrKind : (kindArg ?? "auto");
  const timeout = typeof timeoutOrKind === "number" ? timeoutOrKind : 12000;
  await page.waitForLoadState("networkidle", { timeout }).catch(() => {});
  // Per-route ready signal — Next.js dev mode lazy-compiles each route on
  // first hit, so networkidle alone races first paint of tRPC data.
  const checker = (() => {
    switch (kind) {
      case "lead-form":
        return () =>
          document.querySelector("h1") !== null &&
          (document.body.innerText.includes("Editing version") ||
            document.body.innerText.includes("Page unavailable"));
      case "dashboard":
        return () =>
          /Dashboard/.test(document.body.innerText) &&
          /(Submissions|Last week|Page unavailable)/.test(
            document.body.innerText,
          );
      case "weekly":
        return () =>
          /Weekly/.test(document.body.innerText) &&
          /(Collapse all|Expand all|Toggle All|Page unavailable)/.test(
            document.body.innerText,
          );
      case "admin":
        return () =>
          /(Admin Panel|Page unavailable)/.test(document.body.innerText);
      case "history":
        return () =>
          /(My History|Published reports|Page unavailable)/.test(
            document.body.innerText,
          );
      case "archive":
        return () =>
          /(Published|Archive|Page unavailable)/i.test(document.body.innerText);
      case "trends":
        return () => /Trends|Page unavailable/.test(document.body.innerText);
      case "forbidden":
        return () => /Page unavailable/.test(document.body.innerText);
      case "auto":
      default:
        return () =>
          document.querySelector("main#main-content") !== null ||
          /Page unavailable/.test(document.body.innerText);
    }
  })();
  await page
    .waitForFunction(checker, undefined, { timeout, polling: 200 })
    .catch(() => {});
}
