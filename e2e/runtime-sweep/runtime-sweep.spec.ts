import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import {
  type ConsoleMessage,
  expect,
  type Page,
  type Request,
  test,
} from "@playwright/test";

import {
  ACTIVE_REPORT_ID,
  PUBLISHED_REPORT_ID,
} from "../../prisma/seed-constants.ts";
import { type Catalog, parseCatalog } from "../sweep/catalog-parser.ts";
import { loginByCookie } from "../sweep/helpers/dev-auth.ts";
import {
  type Action,
  type CoverageCell,
  coverageCellSchema,
  type Role,
  roleSchema,
  seedProfileSchema,
  type StateAxes,
} from "./contracts.ts";
import { type DomInventory, inventoryDom } from "./dom-inventory.ts";
import { captureRouteEvidence } from "./evidence-capture.ts";
import type {
  ConsoleRecord,
  PageErrorRecord,
  RequestFailureRecord,
} from "./evidence-types.ts";
import { assertSourceSha, makeCellId } from "./ids.ts";
const ARCHIVE_ROOT = requiredEnv("RUNTIME_SWEEP_ARCHIVE");
const SOURCE_SHA = requiredEnv("RUNTIME_SWEEP_SOURCE_SHA");
assertSourceSha(SOURCE_SHA);
const PROFILE = seedProfileSchema.parse(
  process.env.RUNTIME_SWEEP_PROFILE ?? process.env.E2E_SEED_PROFILE ?? "full",
);
const CATALOG_ROOT = path.resolve(import.meta.dirname, "..", "catalog");
const ROUTE_STATE: StateAxes = {
  profileCapability: "canonical-identities",
  lifecycle: "open",
  submission: "draft",
  ownershipDensity: "single",
  permission: "allowed",
  fault: "none",
  controlTransition: "none",
};
const ROUTE_ORACLE = {
  domainSpecRefs: [
    "openspec/specs/exhaustive-runtime-sweep/spec.md",
    "openspec/specs/behavioral-ui-regression-gate/spec.md",
  ],
  function: {
    required: true,
    expectation: "Route resolves and renders its catalog surface",
  },
  accessibility: {
    required: true,
    expectation: "Visible controls have usable accessible names",
  },
  visual: {
    required: true,
    expectation: "Desktop geometry and full-page capture are stable",
  },
};
function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime sweep requires ${name}`);
  return value;
}
function loadCatalogs(): readonly Catalog[] {
  const files = ["admin.yaml", "head.yaml", "lead.yaml", "viewer.yaml"];
  const catalogs = files.map((file) => {
    const text = readFileSync(path.join(CATALOG_ROOT, file), "utf8");
    const catalog = parseCatalog(text);
    if (!catalog) throw new Error(`Catalog ${file} has no role`);
    return catalog;
  });
  const roles = catalogs.map(({ role }) => roleSchema.parse(role));
  if (new Set(roles).size !== 4)
    throw new Error("Runtime sweep requires four distinct role catalogs");
  return catalogs;
}
function resolveRoute(route: string, role: Role): string {
  const reportId =
    role === "viewer" || route.startsWith("/reports/")
      ? PUBLISHED_REPORT_ID
      : ACTIVE_REPORT_ID;
  const resolved = route.replaceAll("[reportId]", reportId);
  if (resolved.includes("["))
    throw new Error(`Unresolved catalog route placeholder: ${route}`);
  return resolved;
}
async function settle(page: Page): Promise<void> {
  try {
    await page.waitForLoadState("networkidle", { timeout: 3000 });
  } catch (error: unknown) {
    if (!(error instanceof Error) || error.name !== "TimeoutError") throw error;
  }
}
async function navigate(page: Page, route: string): Promise<number | null> {
  try {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    await settle(page);
    return response?.status() ?? null;
  } catch (error: unknown) {
    if (error instanceof Error) return null;
    throw error;
  }
}
function cellAction(role: Role, route: string): Action {
  return {
    controlKey: `route:${role}:${route}`,
    operation: "navigate",
    safety: "read-only",
    transition: "none",
  };
}
function controlEvidence(
  inventory: DomInventory,
  cellId: string,
): CoverageCell["controls"] {
  return inventory.controls.map((control) => ({
    controlKey: control.controlKey,
    cellId,
    ariaRole: control.role,
    accessibleName: control.accessibleName,
    enabled: control.enabled,
    order: control.order,
    actionResult: {
      kind: "not-exercised",
      policy: "unavailable",
      reason:
        "Route baseline inventories controls; the AI driver executes actions in a later lane.",
    },
  }));
}
function eventListeners(page: Page): {
  readonly consoleMessages: ConsoleRecord[];
  readonly pageErrors: PageErrorRecord[];
  readonly requestFailures: RequestFailureRecord[];
  readonly detach: () => void;
} {
  const consoleMessages: ConsoleRecord[] = [];
  const pageErrors: PageErrorRecord[] = [];
  const requestFailures: RequestFailureRecord[] = [];
  const onConsole = (message: ConsoleMessage): void => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    consoleMessages.push({ type: message.type(), text: message.text() });
  };
  const onPageError = (error: Error): void => {
    pageErrors.push({ message: error.message });
  };
  const onRequestFailed = (request: Request): void => {
    requestFailures.push({
      url: request.url(),
      failure: request.failure()?.errorText ?? null,
    });
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);
  return {
    consoleMessages,
    pageErrors,
    requestFailures,
    detach: () => {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      page.off("requestfailed", onRequestFailed);
    },
  };
}
async function writeCell(
  cell: CoverageCell,
  role: Role,
  route: string,
): Promise<void> {
  const directory = path.join(ARCHIVE_ROOT, "cells", PROFILE, role);
  await mkdir(directory, { recursive: true });
  const filePath = path.join(
    directory,
    `${cell.cellId}-${route.replaceAll(/[^a-zA-Z0-9]+/g, "-") || "root"}.json`,
  );
  await writeFile(filePath, `${JSON.stringify(cell, null, 2)}\n`, "utf8");
}
async function sweepRoute(
  page: Page,
  catalog: Role,
  route: string,
): Promise<CoverageCell> {
  const resolvedRoute = resolveRoute(route, catalog);
  const action = cellAction(catalog, route);
  const cellId = makeCellId({
    sourceSha: SOURCE_SHA,
    profile: PROFILE,
    role: catalog,
    catalogRoute: route,
    resolvedRoute,
    state: ROUTE_STATE,
    action,
  });
  const listeners = eventListeners(page);
  const responseStatus = await navigate(page, resolvedRoute);
  const inventory = await inventoryDom(page);
  listeners.detach();
  const evidence = await captureRouteEvidence({
    page,
    archiveRoot: ARCHIVE_ROOT,
    sourceSha: SOURCE_SHA,
    profile: PROFILE,
    role: catalog,
    catalogRoute: route,
    resolvedRoute,
    cellId,
    inventory,
    consoleMessages: listeners.consoleMessages,
    pageErrors: listeners.pageErrors,
    requestFailures: listeners.requestFailures,
    responseStatus,
    capturedAt: new Date().toISOString(),
  });
  const hasFailure = evidence.bundle.observations.some(
    ({ outcome }) => outcome === "fail",
  );
  return coverageCellSchema.parse({
    cellId,
    sourceSha: SOURCE_SHA,
    profile: PROFILE,
    role: catalog,
    catalogRoute: route,
    resolvedRoute,
    viewport: { browser: "chromium", width: 1440, height: 900 },
    state: ROUTE_STATE,
    action,
    oracle: ROUTE_ORACLE,
    controls: controlEvidence(inventory, cellId),
    evidence: evidence.bundle,
    verdict: hasFailure ? "fail" : "pending",
  });
}
const catalogs = loadCatalogs();
for (const catalog of catalogs) {
  const role = roleSchema.parse(catalog.role);
  test(`runtime sweep: ${role}`, async ({ page }, testInfo) => {
    await loginByCookie(page, { role });
    const cells: CoverageCell[] = [];
    for (const entry of catalog.routes) {
      const cell = await sweepRoute(page, role, entry.route);
      cells.push(cell);
      await writeCell(cell, role, entry.route);
    }
    const failed = cells.filter(({ verdict }) => verdict === "fail");
    await testInfo.attach(`${role}-runtime-cells.json`, {
      body: JSON.stringify(cells, null, 2),
      contentType: "application/json",
    });
    expect(failed, JSON.stringify(failed, null, 2)).toHaveLength(0);
  });
}
