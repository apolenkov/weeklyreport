/**
 * Reads the durable Scenario Catalog, walks each role's entry-point routes,
 * and writes console, load, and a11y anomalies to per-role Markdown reports.
 * Findings do not fail CI; that non-blocking contract is deliberate.
 *
 * This is the Layer-1 entry-point sweep ("does every role-reachable route load
 * cleanly?"). Within-route exhaustive exploration is the AI Driver's run-time
 * job, not this spec's.
 *
 * See openspec/specs/behavioral-ui-regression-gate/spec.md + docs/adr/0001 +
 * e2e/catalog/README.md.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { type DbRole } from "@customreport/shared";
import { type ConsoleMessage, type Request,test } from "@playwright/test";

// Import the seed ids directly from the source of truth. NOT via
// e2e/integration/helpers/seed-ids (its `../../../../../` re-export path is
// relative to that file's deeper location and does not resolve from here).
import {
  ACTIVE_REPORT_ID,
  PUBLISHED_REPORT_ID,
} from "../../prisma/seed-constants";
import { type Catalog, parseCatalog } from "./catalog-parser.ts";
import { loginByCookie } from "./helpers/dev-auth";
import { byName } from "./ordering.ts";

type AnomalyKind = "console" | "pageerror" | "load" | "axe" | "network";
interface Anomaly { kind: AnomalyKind; detail: string }
interface RouteResult {
  route: string;
  resolved: string | null;
  access?: DbRole[];
  finalUrl?: string;
  status?: number | null;
  anomalies: Anomaly[];
  skipped?: string;
}

const CATALOG_DIR = path.resolve(import.meta.dirname, "..", "catalog");
const REPORT_DIR = path.resolve(import.meta.dirname, ".reports");

// Known-benign console noise that must NOT be reported as an anomaly.
// Favicon 404s are expected under the sweep shell and are not product defects.
// Dev-tools connection noise is disabled at the source via
// NEXT_PUBLIC_DISABLE_DEVTOOLS in playwright.config.ts — this list must not
// mask real refused connections for widgets the sweep already turns off.
const IGNORED_CONSOLE: RegExp[] = [/favicon\.ico/i];

// Failed-request URLs that are known sweep-environment noise. Kept defensively:
// the dev-tools backend (:4747) is now disabled at the source, but if a future
// change re-enables a dev widget under `next dev` this keeps its noise out while
// still surfacing every other refused URL.
const IGNORED_REQUEST_URLS: RegExp[] = [
  /localhost:4747/i,
  /127\.0\.0\.1:4747/i,
  // External font CDN, not reachable in the sweep env; an app-level concern
  // (runtime dependency on a third-party CDN), not a per-route product defect.
  /fonts\.googleapis\.com/i,
  /fonts\.gstatic\.com/i,
];

/**
 * Resolve a `[reportId]`-style placeholder to a deterministic seed id. Viewers
 * only ever see published reports; the `/reports/*` surface is the shared
 * published view; lead/head/admin land on the active report under `/lead/*`.
 * An unknown placeholder returns null so the walk records a skip-with-reason
 * instead of visiting a broken literal URL.
 */
function resolveRoute(route: string, role: DbRole): string | null {
  if (!route.includes("[")) {
    return route;
  }
  const reportId =
    role === "viewer" || route.startsWith("/reports/")
      ? PUBLISHED_REPORT_ID
      : ACTIVE_REPORT_ID;
  const resolved = route.replace("[reportId]", reportId);
  return resolved.includes("[") ? null : resolved;
}

function loadCatalogs(): Catalog[] {
  if (!fs.existsSync(CATALOG_DIR)) {
    return [];
  }
  return fs
    .readdirSync(CATALOG_DIR)
    .filter((file) => file.endsWith(".yaml"))
    .map((file) =>
      parseCatalog(fs.readFileSync(path.join(CATALOG_DIR, file), "utf8")),
    )
    .filter((catalog): catalog is Catalog => catalog !== null)
    .sort((a, b) => byName(a.role, b.role));
}

function renderReport(role: DbRole, results: RouteResult[]): string {
  const totalAnomalies = results.reduce(
    (sum, result) => sum + result.anomalies.length,
    0,
  );
  const lines: string[] = [
    `# UI sweep report — ${role}`,
    "",
    `Source catalog: \`e2e/catalog/${role}.yaml\` · phase-1 report (non-blocking).`,
    "",
    `**${results.length} routes swept, ${totalAnomalies} anomalies.**`,
    "",
  ];
  for (const result of results) {
    lines.push(`## ${result.route}`);
    if (result.access && result.access.length > 0) {
      lines.push(`- access: ${result.access.join(", ")}`);
    }
    if (result.skipped) {
      lines.push(`- skipped: ${result.skipped}`, "");
      continue;
    }
    if (result.resolved) {
      lines.push(
        `- visited: \`${result.resolved}\` → \`${result.finalUrl ?? "?"}\` (HTTP ${result.status ?? "?"})`,
      );
    }
    if (result.anomalies.length === 0) {
      lines.push("- status: OK");
    } else {
      lines.push(`- status: ${result.anomalies.length} anomalies`);
      for (const anomaly of result.anomalies) {
        lines.push(`  - **${anomaly.kind}**: ${anomaly.detail}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

const catalogs = loadCatalogs();

for (const catalog of catalogs) {
  // Report-only by contract (see the file header): the run must stay green so
  // every role still gets its report, which an assertion here would defeat.
  // eslint-disable-next-line sonarjs/assertions-in-tests -- this test's product is the non-blocking anomaly report
  test(`sweep: ${catalog.role}`, async ({ page }, testInfo) => {
    const results: RouteResult[] = [];

    // Report-only contract: a dev-auth login failure must NOT throw the test
    // (that would write no report for the role). Record it as a role-level
    // anomaly and still emit the report; the route walk is skipped (you cannot
    // sweep what you cannot log into).
    let loggedIn = true;
    try {
      await loginByCookie(page, { role: catalog.role });
    } catch (error) {
      loggedIn = false;
      results.push({
        route: "(dev-auth login)",
        resolved: null,
        anomalies: [
          {
            kind: "load",
            detail: `dev-auth login failed for role ${catalog.role}: ${String(error)}`,
          },
        ],
      });
    }

    for (const entry of loggedIn ? catalog.routes : []) {
      const resolved = resolveRoute(entry.route, catalog.role);
      if (resolved === null) {
        results.push({
          route: entry.route,
          resolved,
          access: entry.access,
          anomalies: [],
          skipped: "unresolved route placeholder (no seed id mapping)",
        });
        continue;
      }

      const anomalies: Anomaly[] = [];
      const onConsole = (msg: ConsoleMessage): void => {
        if (msg.type() !== "error") {
          return;
        }
        const text = msg.text();
        if (IGNORED_CONSOLE.some((re) => re.test(text))) {
          return;
        }
        anomalies.push({ kind: "console", detail: text });
      };
      const onPageError = (err: Error): void => {
        anomalies.push({ kind: "pageerror", detail: err.message });
      };
      // Resource-load failures, captured WITH their URL (the console channel
      // logs them without one). Known dev-tools-endpoint noise is skipped; any
      // other refused URL still surfaces, so this is not a blind filter.
      const onRequestFailed = (request: Request): void => {
        const url = request.url();
        if (IGNORED_REQUEST_URLS.some((re) => re.test(url))) {
          return;
        }
        const failure = request.failure();
        const cause = failure ? ` (${failure.errorText})` : "";
        anomalies.push({
          kind: "network",
          detail: `request failed: ${url}${cause}`,
        });
      };
      page.on("console", onConsole);
      page.on("pageerror", onPageError);
      page.on("requestfailed", onRequestFailed);

      let status: number | null = null;
      try {
        const response = await page.goto(resolved, {
          waitUntil: "domcontentloaded",
        });
        status = response?.status() ?? null;
        if (status !== null && status >= 400) {
          anomalies.push({
            kind: "load",
            detail: `navigation returned HTTP ${status}`,
          });
        }
        // Let client-side render + hydration settle so console/page errors and
        // late-mounting content surface before axe runs.
        // Cap the settle wait: an external resource that hangs (e.g. the Google
        // Fonts CDN, unreachable in the sweep env) must not consume the whole
        // per-test budget. The page is already domcontentloaded from goto().
        await page
          .waitForLoadState("networkidle", { timeout: 3000 })
          .catch(() => undefined);
      } catch (error) {
        anomalies.push({
          kind: "load",
          detail: `navigation failed: ${String(error)}`,
        });
      }

      try {
        const axe = await new AxeBuilder({ page }).analyze();
        for (const violation of axe.violations) {
          // Include the first few node selectors so a11y fixes can be targeted
          // to the offending elements instead of guessed from the rule alone.
          const targets = violation.nodes
            .slice(0, 3)
            .map((node) =>
              node.target
                .map((sel) => (Array.isArray(sel) ? sel.join(" ") : sel))
                .join(" "),
            )
            .join(" | ");
          anomalies.push({
            kind: "axe",
            detail: `${violation.id} (${violation.impact ?? "n/a"}): ${violation.help}${
              targets ? ` — ${targets}` : ""
            }`,
          });
        }
      } catch (error) {
        anomalies.push({ kind: "axe", detail: `axe scan failed: ${String(error)}` });
      }

      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      page.off("requestfailed", onRequestFailed);

      results.push({
        route: entry.route,
        resolved,
        access: entry.access,
        finalUrl: page.url(),
        status,
        anomalies,
      });
    }

    const report = renderReport(catalog.role, results);
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(path.join(REPORT_DIR, `${catalog.role}.md`), report, "utf8");
    await testInfo.attach(`sweep-${catalog.role}.md`, {
      body: report,
      contentType: "text/markdown",
    });

    const totalAnomalies = results.reduce(
      (sum, result) => sum + result.anomalies.length,
      0,
    );
    testInfo.annotations.push({
      type: "sweep",
      description: `${catalog.role}: ${totalAnomalies} anomalies across ${results.length} routes`,
    });
    // The sweep's product is its report; this is its only intended stdout.
     
    console.log(
      `[sweep] ${catalog.role}: ${totalAnomalies} anomalies across ${results.length} routes → e2e/sweep/.reports/${catalog.role}.md`,
    );
  });
}
