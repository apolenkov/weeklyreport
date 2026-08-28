/**
 * Reads the durable Scenario Catalog, walks each role's entry-point routes,
 * and writes console, load, and a11y anomalies to per-role Markdown reports.
 * Each role report is preserved before any anomaly fails the test.
 *
 * This is WeeklyReport's bounded route-health acceptance. One representative
 * mutation lifecycle lives in the smoke project; focused suites own detailed
 * behavior without compiling catalog prose into another test language.
 *
 * See openspec/specs/behavioral-ui-regression-gate/spec.md + docs/adr/0001 +
 * e2e/catalog/README.md.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { type DbRole } from "@customreport/shared";
import {
  type ConsoleMessage,
  expect,
  type Request,
  test,
} from "@playwright/test";

// Import the seed ids directly from the source of truth. NOT via
// e2e/integration/helpers/seed-ids (its `../../../../../` re-export path is
// relative to that file's deeper location and does not resolve from here).
import { resolveCatalogRoute } from "../helpers/catalog-route.ts";
import { isExpectedNavigationAbort, navigate } from "../helpers/navigation.ts";
import {
  CANONICAL_ROLES,
  type Catalog,
  parseCatalog,
} from "../sweep/catalog-parser.ts";
import { loginByCookie } from "../sweep/helpers/dev-auth";
import { byName } from "../sweep/ordering.ts";

type AnomalyKind = "console" | "pageerror" | "load" | "axe" | "network";
interface Anomaly {
  kind: AnomalyKind;
  detail: string;
}
interface RouteResult {
  route: string;
  resolved: string | null;
  access?: DbRole[];
  finalUrl?: string;
  status?: number | null;
  anomalies: Anomaly[];
  warnings: string[];
}

const CATALOG_DIR = path.resolve(import.meta.dirname, "..", "catalog");
const REPORT_DIR = path.resolve(
  import.meta.dirname,
  ".results",
  "route-health",
);

// Known-benign console noise that must NOT be reported as an anomaly.
// Favicon 404s are expected under the sweep shell and are not product defects.
const IGNORED_CONSOLE: RegExp[] = [/favicon\.ico/i];

/**
 * Resolve a `[reportId]`-style placeholder to a deterministic seed id. Viewers
 * only ever see published reports; the `/reports/*` surface is the shared
 * published view; lead/head/admin land on the active report under `/lead/*`.
 * Unknown placeholders fail route resolution so no catalog entry can be
 * silently skipped.
 */
function loadCatalogs(): Catalog[] {
  if (!fs.existsSync(CATALOG_DIR)) {
    return [];
  }
  const catalogs = fs
    .readdirSync(CATALOG_DIR)
    .filter((file) => file.endsWith(".yaml"))
    .map((file) =>
      parseCatalog(fs.readFileSync(path.join(CATALOG_DIR, file), "utf8")),
    )
    .filter((catalog): catalog is Catalog => catalog !== null)
    .sort((a, b) => byName(a.role, b.role));
  const present = new Set(catalogs.map(({ role }) => role));
  const missing = CANONICAL_ROLES.filter((role) => !present.has(role));
  if (missing.length > 0) {
    const missingPaths = missing.map((role) => `e2e/catalog/${role}.yaml`);
    throw new Error(
      `Missing required role catalog(s): ${missingPaths.join(", ")}`,
    );
  }
  return catalogs;
}

function renderReport(role: DbRole, results: RouteResult[]): string {
  const totalAnomalies = results.reduce(
    (sum, result) => sum + result.anomalies.length,
    0,
  );
  const lines: string[] = [
    `# WeeklyReport route-health — ${role}`,
    "",
    `Source catalog: \`e2e/catalog/${role}.yaml\` · blocking acceptance report.`,
    "",
    `**${results.length} routes swept, ${totalAnomalies} anomalies.**`,
    "",
  ];
  for (const result of results) {
    lines.push(`## ${result.route}`);
    if (result.access && result.access.length > 0) {
      lines.push(`- access: ${result.access.join(", ")}`);
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
    for (const warning of result.warnings) {
      lines.push(`- warning: ${warning}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

const catalogs = loadCatalogs();

for (const catalog of catalogs) {
  test(`route-health: ${catalog.role}`, async ({ page }, testInfo) => {
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
        warnings: [],
      });
    }

    for (const entry of loggedIn ? catalog.routes : []) {
      const resolved = resolveCatalogRoute(entry.route, catalog.role);

      const anomalies: Anomaly[] = [];
      const warnings: string[] = [];
      const onConsole = (msg: ConsoleMessage): void => {
        const type = msg.type();
        if (type !== "error" && type !== "warning") {
          return;
        }
        const text = msg.text();
        if (IGNORED_CONSOLE.some((re) => re.test(text))) {
          return;
        }
        if (type === "warning") {
          warnings.push(text);
        } else {
          anomalies.push({ kind: "console", detail: text });
        }
      };
      const onPageError = (err: Error): void => {
        anomalies.push({ kind: "pageerror", detail: err.message });
      };
      // Resource-load failures, captured WITH their URL (the console channel
      // logs them without one). No URLs are suppressed: the Agentation :4747
      // dev backend and Google Fonts are disabled/self-hosted, so every refused
      // URL is a real product defect.
      const onRequestFailed = (request: Request): void => {
        const failure = request.failure();
        if (
          request.isNavigationRequest() &&
          isExpectedNavigationAbort(new Error(failure?.errorText ?? ""))
        ) {
          return;
        }
        const cause = failure ? ` (${failure.errorText})` : "";
        anomalies.push({
          kind: "network",
          detail: `request failed: ${request.url()}${cause}`,
        });
      };
      page.on("console", onConsole);
      page.on("pageerror", onPageError);
      page.on("requestfailed", onRequestFailed);

      let status: number | null = null;
      try {
        status = await navigate(page, resolved);
        if (status !== null && status >= 400) {
          anomalies.push({
            kind: "load",
            detail: `navigation returned HTTP ${status}`,
          });
        }
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
        anomalies.push({
          kind: "axe",
          detail: `axe scan failed: ${String(error)}`,
        });
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
        warnings,
      });
    }

    const report = renderReport(catalog.role, results);
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(REPORT_DIR, `${catalog.role}.md`),
      report,
      "utf8",
    );
    await testInfo.attach(`route-health-${catalog.role}.md`, {
      body: report,
      contentType: "text/markdown",
    });

    const totalAnomalies = results.reduce(
      (sum, result) => sum + result.anomalies.length,
      0,
    );
    testInfo.annotations.push({
      type: "route-health",
      description: `${catalog.role}: ${totalAnomalies} anomalies across ${results.length} routes`,
    });
    console.log(
      `[route-health] ${catalog.role}: ${totalAnomalies} anomalies across ${results.length} routes`,
    );
    expect(totalAnomalies, report).toBe(0);
  });
}
