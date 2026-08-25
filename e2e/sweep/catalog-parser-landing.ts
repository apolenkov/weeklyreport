import type { Role } from "./catalog-parser.ts";

const CATALOG_URL_BASE = "https://runtime-sweep.invalid";
const ROUTE_VALUE_PATTERN = /^\/(?!\/)[^\s#]*$/u;
const LEAD_REPORT_ROUTE = "/lead/report";
const LEAD_HISTORY_ROUTE = "/lead/history";
const HEAD_REPORT_ROUTE = "/head/report";
const HEAD_HISTORY_ROUTE = "/head/history";
const HEAD_SLIDES_ROUTE = "/head/slides";
const REPORT_PRESENT_ROUTE = "/reports/[reportId]/present";
const REPORT_HISTORY_ROUTE = "/reports/history";
const LEAD_ADDRESSED_REPORT_ROUTE = "/lead/report/[reportId]";
const HEAD_PRESENT_ROUTE = "/head/report/[reportId]/present";

type RouteField = "landing";

const REQUIRED_LANDING_ROUTES: Readonly<Record<Role, ReadonlySet<string>>> = {
  lead: new Set([
    LEAD_REPORT_ROUTE,
    LEAD_HISTORY_ROUTE,
    REPORT_PRESENT_ROUTE,
    REPORT_HISTORY_ROUTE,
  ]),
  head: new Set([
    HEAD_REPORT_ROUTE,
    HEAD_HISTORY_ROUTE,
    HEAD_SLIDES_ROUTE,
    HEAD_PRESENT_ROUTE,
    LEAD_HISTORY_ROUTE,
    LEAD_REPORT_ROUTE,
    LEAD_ADDRESSED_REPORT_ROUTE,
    REPORT_PRESENT_ROUTE,
    REPORT_HISTORY_ROUTE,
  ]),
  admin: new Set([
    "/admin/products",
    "/admin/activities",
    "/admin/settings",
    HEAD_HISTORY_ROUTE,
    HEAD_REPORT_ROUTE,
    HEAD_PRESENT_ROUTE,
    HEAD_SLIDES_ROUTE,
    LEAD_HISTORY_ROUTE,
    LEAD_REPORT_ROUTE,
    LEAD_ADDRESSED_REPORT_ROUTE,
    REPORT_PRESENT_ROUTE,
    REPORT_HISTORY_ROUTE,
  ]),
  viewer: new Set([REPORT_PRESENT_ROUTE, REPORT_HISTORY_ROUTE]),
};

export const landingDeclarationRequiredFor = (
  role: Role,
  route: string,
): boolean => REQUIRED_LANDING_ROUTES[role].has(route);

export interface ParsedLanding {
  readonly landing: string;
  readonly seenRouteFields: ReadonlySet<RouteField>;
}

function unquote(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed
      .slice(1, -1)
      .replaceAll(String.raw`\"`, '"')
      .replaceAll(String.raw`\\`, "\\");
  }
  return trimmed;
}

function malformedLanding(route: string, landing: string): never {
  throw new Error(`Malformed landing URL on route ${route}: "${landing}"`);
}

function parseLandingUrl(route: string, landing: string): URL {
  try {
    return new URL(landing, CATALOG_URL_BASE);
  } catch (error: unknown) {
    throw new Error(
      `Malformed landing URL on route ${route}: ${
        error instanceof Error ? error.message : "invalid URL"
      }`,
    );
  }
}

export function parseLandingLine(
  line: string,
  route: string,
  seenRouteFields: ReadonlySet<RouteField>,
): ParsedLanding | null {
  const landingMatch = /^ {4}landing:\s*(\S.*)?$/u.exec(line);
  if (landingMatch === null) return null;
  if (seenRouteFields.has("landing"))
    throw new Error('Duplicate route field: "landing"');
  const raw = landingMatch[1];
  if (raw === undefined) throw new Error(`Blank landing URL on route ${route}`);
  const landing = unquote(raw);
  if (landing === "") throw new Error(`Blank landing URL on route ${route}`);
  if (!ROUTE_VALUE_PATTERN.test(landing)) malformedLanding(route, landing);
  const parsed = parseLandingUrl(route, landing);
  if (
    parsed.origin !== CATALOG_URL_BASE ||
    parsed.hash !== "" ||
    `${parsed.pathname}${parsed.search}` !== landing
  )
    malformedLanding(route, landing);
  return {
    landing,
    seenRouteFields: new Set<RouteField>([...seenRouteFields, "landing"]),
  };
}

export const isLandingFieldLine = (line: string): boolean =>
  /^\s*landing\s*:/u.test(line);

export function assertRequiredLandings(
  role: Role,
  routes: readonly { route: string; landing?: string | undefined }[],
): void {
  for (const route of routes) {
    if (
      landingDeclarationRequiredFor(role, route.route) &&
      route.landing === undefined
    )
      throw new Error(
        `Route ${route.route} in ${role} catalog is an intentional redirect alias and requires an exact landing URL`,
      );
  }
}
