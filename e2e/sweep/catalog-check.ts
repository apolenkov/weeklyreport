// ============================================================================
// Catalog drift gate for the durable per-role scenario catalog.
//
// Re-derives the app's ROUTE surface from the Next.js App Router on disk and
// fails when code exposes a route that no role catalog covers — naming the
// uncovered route. The catalog (e2e/catalog/<role>.yaml) is route-anchored, so
// the checkable "surface" is the set of page routes, not tRPC procedures or
// Prisma enums (the design's original tRPC/enum framing predates the catalog's
// pivot to a per-role route catalog — see e2e/catalog/README.md).
//
// Checks (all route-level; exit 1 on any finding):
//   1. forward  — every code route (minus the documented system excludes)
//                 appears in at least one role catalog.
//   2. reverse  — every catalog route exists in code (catches stale routes
//                 left behind after a page is deleted/renamed).
//   3. hygiene  — every catalog `route:` value is a clean URL path and every
//                 parsed route declares a non-empty `access:` list (the
//                 silent-skip defects hardened in _generation-notes.md).
//   4. role     — every route's `access:` list agrees with the catalogs in
//                 both directions: a role named in access has the route in its
//                 own catalog, and a route catalogued for a role names that
//                 role in access.
//
// Pure Node, NO dependencies. Run from the repo root:
//   node e2e/sweep/catalog-check.ts   (aliased as `pnpm catalog:check`)
// ============================================================================
import * as fs from "node:fs";
import * as path from "node:path";

import {
  CANONICAL_ROLES,
  type Catalog,
  parseCatalog,
} from "./catalog-parser.ts";
import { byName } from "./ordering.ts";

const HERE = import.meta.dirname;
const REPO_ROOT = path.resolve(HERE, "..", "..");
const CATALOG_DIR = path.resolve(HERE, "..", "catalog");
const APP_DIR = path.resolve(REPO_ROOT, "apps", "web", "src", "app");

// System / export / pre-auth routes that are deliberately NOT role nav surface
// and so are never catalog scenarios. Documented in e2e/catalog/README.md
// ("/print/[reportId] is a system/export view, swept separately if at all").
const EXCLUDED_ROUTES = new Set([
  "/print/[reportId]", // PDF/export render target, not a nav intent
  "/auth/error", // unauthenticated SAML error page, outside the app shell
]);

// A clean catalog route is "/" or "/segment[/segment...]" with no whitespace or
// trailing prose. Mirrors the parser's route regex + _generation-notes.md check.
const CLEAN_ROUTE = /^\/\S*$/;

interface LoadedCatalog {
  readonly file: string;
  readonly parsed: Catalog;
  readonly dirtyRoutes: readonly string[];
}

// Derive a Next.js App Router route from a page.tsx path:
//   apps/web/src/app/(app)/lead/report/[reportId]/page.tsx -> /lead/report/[reportId]
// Route groups "(group)" are stripped; dynamic "[param]" segments are kept
// verbatim (the catalog keeps them as-is). The root page.tsx maps to "/".
function pageToRoute(absPageFile: string): string {
  const rel = path.relative(APP_DIR, path.dirname(absPageFile));
  const segments = rel
    .split(path.sep)
    .filter((s) => s !== "" && !/^\(.*\)$/.test(s));
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

// Recursively collect every page.tsx under the App Router and map to its route.
function collectCodeRoutes(dir: string): Set<string> {
  const routes = new Set<string>();
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const r of collectCodeRoutes(full)) routes.add(r);
    } else if (entry.name === "page.tsx") {
      routes.add(pageToRoute(full));
    }
  }
  return routes;
}

// Raw line scan for hygiene defects the parser would silently drop.
const dirtyRoutesOf = (text: string): readonly string[] =>
  text
    .split("\n")
    // Trim in code rather than with a trailing `\s*`: pairing that with a lazy
    // capture makes the split between them ambiguous on every space.
    .map((line) => /^\s*-\s*route:(.*)$/.exec(line)?.[1]?.trim())
    .filter(
      (value): value is string =>
        value !== undefined && !CLEAN_ROUTE.test(value),
    );

// Load every role catalog: the parsed routes (clean lines only) plus the raw
// scan above.
function loadCatalogs(): readonly LoadedCatalog[] {
  return fs
    .readdirSync(CATALOG_DIR)
    .filter((f) => f.endsWith(".yaml"))
    .sort(byName)
    .flatMap((file) => {
      const text = fs.readFileSync(path.join(CATALOG_DIR, file), "utf8");
      const parsed = parseCatalog(text);
      return parsed ? [{ file, parsed, dirtyRoutes: dirtyRoutesOf(text) }] : [];
    });
}

const roleCatalogFindings = (
  catalogs: readonly LoadedCatalog[],
): readonly string[] => {
  const present = new Set(catalogs.map(({ parsed }) => parsed.role));
  return CANONICAL_ROLES.filter((role) => !present.has(role)).map(
    (role) => `missing required role catalog: e2e/catalog/${role}.yaml`,
  );
};

// 1. forward: code route with no catalog scenario.
const uncoveredRoutes = (
  codeRoutes: ReadonlySet<string>,
  catalogRoutes: ReadonlySet<string>,
): readonly string[] =>
  [...codeRoutes]
    .sort(byName)
    .filter((route) => !EXCLUDED_ROUTES.has(route) && !catalogRoutes.has(route))
    .map((route) => `uncovered code route (no catalog scenario): ${route}`);

// 2. reverse: catalog route that no longer exists in code.
const staleRoutes = (
  catalogs: readonly LoadedCatalog[],
  codeRoutes: ReadonlySet<string>,
): readonly string[] =>
  catalogs.flatMap(({ file, parsed }) =>
    parsed.routes
      .filter(({ route }) => !codeRoutes.has(route))
      .map(
        ({ route }) =>
          `stale catalog route (absent from code): ${route} (${file})`,
      ),
  );

// 3. hygiene: malformed route value or empty access list.
const hygieneFindings = (
  catalogs: readonly LoadedCatalog[],
): readonly string[] =>
  catalogs.flatMap(({ file, parsed, dirtyRoutes }) => [
    ...dirtyRoutes.map(
      (value) =>
        `malformed route value (not a clean URL): "${value}" (${file})`,
    ),
    ...parsed.routes
      .filter(({ access }) => access.length === 0)
      .map(({ route }) => `empty access list on route: ${route} (${file})`),
  ]);

// 4. role consistency: a route that names role X in its `access:` list must
// appear in X's catalog, and a route present in X's catalog must name X in its
// access. This is the matrix the catalogs themselves declare — deriving it
// from the guarded surface would require modelling every route's guard, which
// the catalogs already encode per role.
const roleConsistencyFindings = (
  catalogs: readonly LoadedCatalog[],
): readonly string[] => {
  const routeRoles = new Map<string, Set<string>>();
  for (const { parsed } of catalogs) {
    for (const { route } of parsed.routes) {
      const roles = routeRoles.get(route) ?? new Set<string>();
      roles.add(parsed.role);
      routeRoles.set(route, roles);
    }
  }

  return catalogs.flatMap(({ file, parsed }) => {
    const findings: string[] = [];
    for (const { route, access } of parsed.routes) {
      for (const accessRole of access) {
        if (!(routeRoles.get(route) ?? new Set()).has(accessRole)) {
          findings.push(
            `route ${route} declares access [${accessRole}] but is absent from ${accessRole}.yaml (${file})`,
          );
        }
      }
      if (!access.includes(parsed.role)) {
        findings.push(
          `route ${route} is catalogued for ${parsed.role} but its access list omits ${parsed.role} (${file})`,
        );
      }
    }
    return findings;
  });
};

const guardConsistencyFindings = (
  catalogs: readonly LoadedCatalog[],
): readonly string[] => {
  const policySource = fs.readFileSync(
    path.resolve(REPO_ROOT, "apps/web/src/shared/model/route-role-policy.ts"),
    "utf8",
  );
  const policyRoles = (name: string): readonly string[] => {
    const match = new RegExp(
      String.raw`export const ${name}:[^=]+=[\s\S]*?\[([\s\S]*?)\];`,
      "u",
    ).exec(policySource);
    if (match?.[1] === undefined)
      throw new Error(`Cannot read guarded-role policy ${name}`);
    return [...match[1].matchAll(/["'](lead|head|admin|viewer)["']/gu)].flatMap(
      (role) => (role[1] === undefined ? [] : [role[1]]),
    );
  };
  const rolesForRoute = (route: string): readonly string[] | null => {
    if (route === "/lead/report/[reportId]/preview")
      return policyRoles("LEAD_PREVIEW_ROUTE_ROLES");
    if (route === "/reports/latest")
      return policyRoles("VIEWER_STATUS_ROUTE_ROLES");
    if (route === "/admin" || route.startsWith("/admin/"))
      return policyRoles("ADMIN_ROUTE_ROLES");
    if (route === "/head" || route.startsWith("/head/"))
      return policyRoles("HEAD_ROUTE_ROLES");
    if (route === "/lead" || route.startsWith("/lead/"))
      return policyRoles("LEAD_ROUTE_ROLES");
    if (route === "/reports" || route.startsWith("/reports/"))
      return policyRoles("REPORTS_ROUTE_ROLES");
    return null;
  };
  const routeRoles = Map.groupBy(
    catalogs.flatMap(({ parsed }) =>
      parsed.routes.map(({ route }) => ({ role: parsed.role, route })),
    ),
    ({ route }) => route,
  );
  return [...routeRoles.entries()].flatMap(([route, entries]) => {
    const guardedRoles = rolesForRoute(route);
    if (guardedRoles === null) return [];
    const expected = guardedRoles.toSorted((left, right) =>
      left.localeCompare(right),
    );
    const actual = [...new Set(entries.map(({ role }) => role))].toSorted(
      (left, right) => left.localeCompare(right),
    );
    return expected.join("\0") === actual.join("\0")
      ? []
      : [
          `route ${route} catalog roles [${actual.join(", ")}] disagree with its layout guard [${expected.join(", ")}]`,
        ];
  });
};

function main(): void {
  if (!fs.existsSync(APP_DIR)) {
    console.error(`No App Router dir at ${APP_DIR}`);
    process.exit(1);
  }
  if (!fs.existsSync(CATALOG_DIR)) {
    console.error(`No catalog dir at ${CATALOG_DIR}`);
    process.exit(1);
  }

  const codeRoutes = collectCodeRoutes(APP_DIR);
  const catalogs = loadCatalogs();
  if (catalogs.length === 0) {
    console.error("No <role>.yaml catalogs parsed — cannot check drift.");
    process.exit(1);
  }

  const catalogRoutes = new Set(
    catalogs.flatMap(({ parsed }) => parsed.routes.map((r) => r.route)),
  );

  const findings = [
    ...roleCatalogFindings(catalogs),
    ...uncoveredRoutes(codeRoutes, catalogRoutes),
    ...staleRoutes(catalogs, codeRoutes),
    ...hygieneFindings(catalogs),
    ...roleConsistencyFindings(catalogs),
    ...guardConsistencyFindings(catalogs),
  ];

  if (findings.length > 0) {
    console.error(`catalog:check — ${findings.length} drift finding(s):`);
    for (const f of findings) console.error(`  - ${f}`);
    console.error(
      "\nFix: add the missing scenario to the relevant e2e/catalog/<role>.yaml " +
        "(or, for a genuine system/export route, add it to EXCLUDED_ROUTES with a " +
        "one-line reason).",
    );
    process.exit(1);
  }

  console.log(
    `catalog:check OK — ${codeRoutes.size} code routes ` +
      `(${EXCLUDED_ROUTES.size} excluded), ${catalogRoutes.size} catalog routes, ` +
      `no drift.`,
  );
}

main();
