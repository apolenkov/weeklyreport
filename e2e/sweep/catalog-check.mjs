// ============================================================================
// Catalog drift gate (establish-scenario-catalog SC-6).
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
//
// NOT checked here (deliberate; see the change's tasks.md): per-role
// exhaustiveness ("every role that can reach a route must list it") — that is a
// stronger invariant than SC-6 asks for and the catalog is intentionally
// inconsistent about impersonation-only routes; and access-vs-guard consistency
// (would need to model the unguarded root). Both are left as follow-ups.
//
// Pure Node, NO dependencies. Run from the repo root:
//   node e2e/sweep/catalog-check.mjs   (aliased as `pnpm catalog:check`)
// ============================================================================
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parseCatalog } from "./catalog-parser.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
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

// Derive a Next.js App Router route from a page.tsx path:
//   apps/web/src/app/(app)/lead/report/[reportId]/page.tsx -> /lead/report/[reportId]
// Route groups "(group)" are stripped; dynamic "[param]" segments are kept
// verbatim (the catalog keeps them as-is). The root page.tsx maps to "/".
function pageToRoute(absPageFile) {
  const rel = path.relative(APP_DIR, path.dirname(absPageFile));
  const segments = rel
    .split(path.sep)
    .filter((s) => s !== "" && !/^\(.*\)$/.test(s));
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

// Recursively collect every page.tsx under the App Router and map to its route.
function collectCodeRoutes(dir) {
  const routes = new Set();
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

// Load every role catalog: the parsed routes (clean lines only) plus a raw
// line scan for hygiene defects the parser would silently drop.
function loadCatalogs() {
  const files = fs
    .readdirSync(CATALOG_DIR)
    .filter((f) => f.endsWith(".yaml"))
    .sort();
  const catalogs = [];
  for (const file of files) {
    const text = fs.readFileSync(path.join(CATALOG_DIR, file), "utf8");
    const parsed = parseCatalog(text);
    if (!parsed) continue;
    const dirtyRoutes = text
      .split("\n")
      .map((line) => /^\s*-\s*route:\s*(.+?)\s*$/.exec(line)?.[1])
      .filter((value) => value !== undefined && !CLEAN_ROUTE.test(value));
    catalogs.push({ file, parsed, dirtyRoutes });
  }
  return catalogs;
}

function main() {
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

  const findings = [];

  // 1. forward: code route with no catalog scenario.
  for (const route of [...codeRoutes].sort()) {
    if (EXCLUDED_ROUTES.has(route)) continue;
    if (!catalogRoutes.has(route)) {
      findings.push(`uncovered code route (no catalog scenario): ${route}`);
    }
  }

  // 2. reverse: catalog route that no longer exists in code.
  for (const { file, parsed } of catalogs) {
    for (const { route } of parsed.routes) {
      if (!codeRoutes.has(route)) {
        findings.push(`stale catalog route (absent from code): ${route} (${file})`);
      }
    }
  }

  // 3. hygiene: malformed route value or empty access list.
  for (const { file, parsed, dirtyRoutes } of catalogs) {
    for (const value of dirtyRoutes) {
      findings.push(`malformed route value (not a clean URL): "${value}" (${file})`);
    }
    for (const { route, access } of parsed.routes) {
      if (access.length === 0) {
        findings.push(`empty access list on route: ${route} (${file})`);
      }
    }
  }

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
