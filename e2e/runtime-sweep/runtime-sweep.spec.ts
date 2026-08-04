import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  type Catalog,
  type CatalogRoute,
  parseCatalog,
} from "../sweep/catalog-parser.ts";
import { loginByCookie } from "../sweep/helpers/dev-auth.ts";
import { roleSchema, seedProfileSchema } from "./contracts.ts";
import { navigate } from "./navigation.ts";
import { bindCatalogRoute } from "./route-binding.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime route baseline requires ${name}`);
  return value;
};

const PROFILE = seedProfileSchema.parse(
  process.env.RUNTIME_SWEEP_PROFILE ?? process.env.E2E_SEED_PROFILE ?? "full",
);
const CATALOG_ROOT = path.resolve(import.meta.dirname, "..", "catalog");
requiredEnv("RUNTIME_SWEEP_SOURCE_SHA");
requiredEnv("RUNTIME_SWEEP_ARCHIVE");

const loadCatalogs = (): readonly Catalog[] =>
  ["admin.yaml", "head.yaml", "lead.yaml", "viewer.yaml"].map((file) => {
    const catalog = parseCatalog(
      readFileSync(path.join(CATALOG_ROOT, file), "utf8"),
    );
    if (!catalog) throw new Error(`Catalog ${file} has no role`);
    return catalog;
  });

const assignedRoute = (
  route: CatalogRoute,
  role: Catalog["role"],
): string | undefined => {
  const binding = bindCatalogRoute(route, role).bindings.find(
    (candidate) =>
      candidate.profile === PROFILE && candidate.status === "assigned",
  );
  return binding?.resolvedRoute;
};

const catalogs = loadCatalogs();
type RouteStatus = Readonly<{ route: string; status: number | null }>;

for (const catalog of catalogs) {
  const role = roleSchema.parse(catalog.role);
  test(`runtime route liveness: ${role}`, async ({ page }, testInfo) => {
    await loginByCookie(page, { role });
    const statuses = await catalog.routes.reduce(
      async (pending, route): Promise<readonly RouteStatus[]> => {
        const statuses = await pending;
        const resolvedRoute = assignedRoute(route, role);
        if (resolvedRoute === undefined) return statuses;
        return [
          ...statuses,
          { route: route.route, status: await navigate(page, resolvedRoute) },
        ];
      },
      Promise.resolve<readonly RouteStatus[]>([]),
    );
    await testInfo.attach(`${role}-route-liveness.json`, {
      body: JSON.stringify(statuses, null, 2),
      contentType: "application/json",
    });
    expect(
      statuses.filter(({ status }) => status === null || status >= 400),
    ).toHaveLength(0);
  });
}
