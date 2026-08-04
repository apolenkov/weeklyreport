// Minimal helpers for the tracked uat-suite scripts. Headless-only.
// Larger probe-helpers from apps/web/.tmp/uat-suite/ are NOT mirrored here —
// the tracked scripts are intentionally lightweight so CI can run them.

// The UAT suite probes a specific running app. A silent localhost default can
// point CI or an operator at the wrong local process; require an explicit base
// URL and validate it before the first navigation.
function requireUatBaseUrl() {
  const raw = process.env.UAT_BASE_URL;
  if (!raw) {
    throw new Error(
      "UAT_BASE_URL is required: set it to the running web origin " +
        "(e.g. http://localhost:3000 for `pnpm dev`, or the CI target).",
    );
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`UAT_BASE_URL is not a valid URL: ${raw}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`UAT_BASE_URL must be an http(s) URL: ${raw}`);
  }
  return parsed.origin;
}

export const BASE = requireUatBaseUrl();

export function emit(id, status, msg, detail = "") {
  const icon =
    status === "PASS"
      ? "✓"
      : status === "FAIL"
        ? "✗"
        : status === "WARN"
          ? "⚠"
          : "·";
  const detailSuffix = detail ? ` — ${detail.slice(0, 200)}` : "";
  const line = `${icon} ${id} [${status}] ${msg}${detailSuffix}`;
  process.stdout.write(line + "\n");
}

export const note = (msg) => process.stdout.write(`· ${msg}\n`);

export async function loginAs(page, role, email) {
  const url = email
    ? `${BASE}/auth/dev-login?role=${role}&email=${encodeURIComponent(email)}`
    : `${BASE}/auth/dev-login?role=${role}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  await waitForAppReady(page, undefined, undefined, role);
}

export async function waitForAppReady(
  page,
  timeoutOrKind = 12000,
  kindArg,
  roleLabel,
) {
  const kind =
    typeof timeoutOrKind === "string" ? timeoutOrKind : (kindArg ?? "auto");
  const timeout = typeof timeoutOrKind === "number" ? timeoutOrKind : 12000;
  // networkidle is a soft drain: some routes stay chatty, so its timeout is
  // allowed. The route-ready predicate below is the real readiness gate.
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
  try {
    await page.waitForFunction(checker, undefined, { timeout, polling: 200 });
  } catch {
    // A route that never signals readiness must fail the scenario, not sail
    // through as though startup succeeded.
    const route = page.url();
    const lastState = await page.evaluate(() =>
      (document.body.innerText || "").slice(0, 300),
    );
    const rolePart = roleLabel ? `, role=${roleLabel}` : "";
    throw new Error(
      `Route readiness timed out (${kind}${rolePart}) at ${route}. Last visible state: ${lastState}`,
    );
  }
}
