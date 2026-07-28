/**
 * Loads every catalog route under the production CSP and fails on any browser
 * violation. This is blocking because a violation means the deployed policy
 * already prevents part of the application from running.
 *
 * Fidelity notes:
 * - The policy string is the production one verbatim minus `report-uri`, which
 *   needs a collector this harness has none of. Directives are what the
 *   browser enforces; the report target only decides where it tattles.
 * - `connect-src 'self'` is faithful here even though web and api listen on
 *   different ports: the tRPC client calls the relative `/trpc`
 *   (apps/web/src/lib/trpc.ts), which Next rewrites server-side, exactly as
 *   caddy does in production.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test } from "@playwright/test";

import { ACTIVE_REPORT_ID, PUBLISHED_REPORT_ID } from "../../prisma/seed-constants";
import { parseCatalog } from "../sweep/catalog-parser.ts";
import { loginByCookie } from "../sweep/helpers/dev-auth";
import { byName } from "../sweep/ordering.ts";

// Derived, never re-declared: the e2e tree cannot import the shared role
// schema, and spelling the union out again is exactly what the
// status-literal-union gate exists to prevent.
type Role = Parameters<typeof loginByCookie>[1]["role"];

interface CspViolation {
  directive: string;
  blockedURI: string;
  sourceFile: string;
  lineNumber: number;
}

interface RouteFinding {
  role: Role;
  route: string;
  violations: CspViolation[];
}

const CATALOG_DIR = path.resolve(import.meta.dirname, "..", "catalog");

// The catalog directory IS the enumeration of role surfaces — one
// `<role>.yaml` per role — so a new role's catalog is covered the day it
// lands, with no list here to forget to update.
const CATALOG_ROLES: readonly Role[] = fs
  .readdirSync(CATALOG_DIR)
  .filter((file) => file.endsWith(".yaml"))
  .map((file) => path.basename(file, ".yaml") as Role)
  .sort(byName);

const REPORT_PATH = path.resolve(import.meta.dirname, ".reports", "csp-validation.md");

// Byte-identical to deploy/caddy/Caddyfile's enforcing header apart from the
// dropped report-uri. Keep the two in lockstep: a directive added there and
// not here means the next flip ships unvalidated.
const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
].join("; ");

function resolveRoute(route: string, role: Role): string | null {
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

function loadCatalog(role: Role): readonly string[] {
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
        const resolved = resolveRoute(route, role);
        if (resolved === null) {
          continue;
        }

        await page.goto(resolved, { waitUntil: "domcontentloaded" });
        // Violations from deferred/hydration work fire after the document is
        // parsed; without this settle the walk reports a clean page that in
        // fact broke a moment later.
        await page.waitForLoadState("networkidle").catch(() => undefined);

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
