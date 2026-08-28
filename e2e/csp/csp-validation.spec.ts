/**
 * Loads every catalog route under the production CSP and fails on any browser
 * violation. This is blocking because a violation means the deployed policy
 * already prevents part of the application from running.
 *
 * Fidelity notes:
 * - The policy is parsed from deploy/caddy/Caddyfile (never hand-duplicated)
 *   and used minus `report-uri`, which needs a collector this harness has none
 *   of. Directives are what the browser enforces; the report target only
 *   decides where it tattles.
 * - `connect-src 'self'` is faithful here even though web and api listen on
 *   different ports: the tRPC client calls the relative `/trpc`
 *   (apps/web/src/shared/lib/trpc/trpc.ts), which Next rewrites server-side, exactly as
 *   caddy does in production.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import type { Role as CspRole } from "@customreport/shared";
import { errors, expect, test } from "@playwright/test";

import { resolveCatalogRoute } from "../helpers/catalog-route.ts";
import { parseCatalog } from "../sweep/catalog-parser.ts";
import { loginByCookie } from "../sweep/helpers/dev-auth";
import { byName } from "../sweep/ordering.ts";
import { readCaddyCsp, stripReportUri } from "./caddy-policy.ts";

interface CspViolation {
  directive: string;
  blockedURI: string;
  sourceFile: string;
  lineNumber: number;
}

interface RouteFinding {
  role: CspRole;
  route: string;
  violations: CspViolation[];
}

const CATALOG_DIR = path.resolve(import.meta.dirname, "..", "catalog");

// Deferred/hydration resources can legitimately outlive networkidle; this
// bounds the settle so one hanging resource cannot eat the whole run budget.
const SETTLE_TIMEOUT_MS = 10_000;

// Playwright marks a timed-out wait with a TimeoutError; only that error means
// "the page settled as far as we allow" — anything else is a real failure.
function isSettleTimeout(error: unknown): error is errors.TimeoutError {
  return error instanceof errors.TimeoutError;
}

// The catalog directory IS the enumeration of role surfaces — one
// `<role>.yaml` per role — so a new role's catalog is covered the day it
// lands, with no list here to forget to update.
const CATALOG_ROLES: readonly CspRole[] = fs
  .readdirSync(CATALOG_DIR)
  .filter((file) => file.endsWith(".yaml"))
  .map((file) => path.basename(file, ".yaml") as CspRole)
  .sort(byName);

const REPORT_PATH = path.resolve(
  import.meta.dirname,
  ".reports",
  "csp-validation.md",
);

// Derived from deploy/caddy/Caddyfile, never re-declared by hand: a deploy
// header change without a matching test change must fail the walk, not drift.
// The report-uri directive is dropped because the harness has no collector;
// every browser-enforced directive stays byte-identical.
const PRODUCTION_CSP = stripReportUri(readCaddyCsp());

function loadCatalog(role: CspRole): readonly string[] {
  const file = path.join(CATALOG_DIR, `${role}.yaml`);
  if (!fs.existsSync(file)) return [];
  const parsed = parseCatalog(fs.readFileSync(file, "utf8"));
  return parsed?.routes.map((entry) => entry.route) ?? [];
}

function renderReport(findings: readonly RouteFinding[]): string {
  const total = findings.reduce((sum, f) => sum + f.violations.length, 0);
  const header = [
    "# CSP validation",
    "",
    `Policy under test: \`${PRODUCTION_CSP}\``,
    "",
    `**${findings.length} route loads with violations, ${total} violations total.**`,
    "",
  ];
  const body = findings.flatMap((finding) => [
    `## ${finding.role} — ${finding.route}`,
    ...finding.violations.map((v) => {
      const origin = v.sourceFile ? ` (${v.sourceFile}:${v.lineNumber})` : "";
      return `- \`${v.directive}\` blocked \`${v.blockedURI}\`${origin}`;
    }),
    "",
  ]);
  return [...header, ...body].join("\n");
}

const collectViolations = () => {
  const store: CspViolation[] = [];
  Object.defineProperty(window, "__cspViolations", { value: store });
  document.addEventListener("securitypolicyviolation", (event) => {
    store.push({
      directive: event.violatedDirective,
      blockedURI: event.blockedURI,
      sourceFile: event.sourceFile,
      lineNumber: event.lineNumber,
    });
  });
};

test.describe("Content-Security-Policy", () => {
  const findings: RouteFinding[] = [];

  test.afterAll(() => {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, renderReport(findings), "utf8");
  });

  for (const role of CATALOG_ROLES) {
    test(`${role} surfaces load without violating the production policy`, async ({
      page,
    }) => {
      const routes = loadCatalog(role);
      expect(
        routes.length,
        `no routes parsed from e2e/catalog/${role}.yaml`,
      ).toBeGreaterThan(0);

      // Only documents carry the header; subresources inherit the policy from
      // the document that loaded them, so intercepting everything would only
      // add latency.
      await page.route("**/*", async (route) => {
        if (route.request().resourceType() !== "document") {
          return route.continue();
        }
        const response = await route.fetch();
        await route.fulfill({
          response,
          headers: {
            ...response.headers(),
            "content-security-policy": PRODUCTION_CSP,
          },
        });
      });

      await page.addInitScript(collectViolations);
      await loginByCookie(page, { role });

      for (const route of routes) {
        // An unresolved dynamic token throws here instead of silently skipping
        // the route: a newly-catalogued dynamic route must not escape the walk.
        const resolved = resolveCatalogRoute(route, role);

        await page.goto(resolved, { waitUntil: "domcontentloaded" });
        // Violations from deferred/hydration work fire after the document is
        // parsed; without this settle the walk reports a clean page that in
        // fact broke a moment later. A settle timeout is a bounded explicit
        // wait (deferred resources can outlive networkidle); a navigation or
        // load failure is not a settled page and must fail the walk.
        try {
          await page.waitForLoadState("networkidle", {
            timeout: SETTLE_TIMEOUT_MS,
          });
        } catch (error) {
          if (!isSettleTimeout(error)) {
            throw error;
          }
        }

        const violations = await page.evaluate(
          () =>
            (window as unknown as { __cspViolations?: CspViolation[] })
              .__cspViolations ?? [],
        );

        if (violations.length > 0) {
          findings.push({ role, route, violations });
          await page.evaluate(() => {
            (
              window as unknown as { __cspViolations: CspViolation[] }
            ).__cspViolations.length = 0;
          });
        }
      }

      const own = findings.filter((finding) => finding.role === role);
      expect(
        own,
        `${role} routes violating the production CSP:\n${renderReport(own)}`,
      ).toEqual([]);
    });
  }
});
