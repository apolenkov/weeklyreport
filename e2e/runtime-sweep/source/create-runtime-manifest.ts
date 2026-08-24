import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { SEED_PROFILE_MANIFESTS } from "../../../prisma/seeds/profiles/seed-profile-contract.ts";
import { type Catalog, parseCatalog } from "../../sweep/catalog-parser.ts";
import {
  type CampaignManifestInput,
  writeCampaignSource,
} from "../manifest/manifest.ts";
import {
  DEFAULT_MAX_CASES,
  DEFAULT_MAX_CONTROLS_PER_SEGMENT,
  DEFAULT_MAX_REVEAL_ACTIONS,
  DEFAULT_MAX_REVEAL_MATERIAL_EDGES,
} from "../matrix/matrix-limits.ts";
import { routeDeclarationFromCatalog } from "../support/route-binding.ts";
import {
  type Action,
  ACTION_OPERATIONS,
  CANONICAL_ROLES,
  CONTROL_TRANSITIONS,
  FAULT_MODES,
  LIFECYCLE_STATES,
  OWNERSHIP_DENSITIES,
  PERMISSION_BOUNDARIES,
  roleSchema,
  SEED_CAPABILITIES,
  SEED_PROFILES,
  STATE_KINDS,
  SUBMISSION_STATES,
} from "./contracts.ts";
import {
  assertRouteNetworkPolicyCoverage,
  networkPolicyForRoute,
} from "./route-network-policy.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const CATALOG_ROOT = path.join(REPO_ROOT, "e2e", "catalog");
const OWNER_BOUNDARY = "Owner-declared campaign boundary";

function requiredEnv(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Runtime manifest requires ${name}`);
  return value;
}

const optionalEnv = (
  environment: NodeJS.ProcessEnv,
  name: string,
): string | undefined => {
  const value = environment[name]?.trim();
  return value === undefined || value === "" ? undefined : value;
};

const exactArchiveArtifactPath = (
  archiveRoot: string,
  configuredPath: string,
  name: string,
  fileName: string,
): string => {
  const expected = path.join(archiveRoot, fileName);
  const actual = path.resolve(configuredPath);
  if (actual !== expected) throw new Error(`${name} must equal ${expected}`);
  return actual;
};

function command(executable: string, args: readonly string[]): string {
  return execFileSync(executable, [...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function loadCatalogs(): readonly Catalog[] {
  return CANONICAL_ROLES.map((role) => {
    const text = readFileSync(path.join(CATALOG_ROOT, `${role}.yaml`), "utf8");
    const catalog = parseCatalog(text);
    if (!catalog || roleSchema.parse(catalog.role) !== role) {
      throw new Error(`Catalog ${role}.yaml has an invalid role`);
    }
    return catalog;
  });
}

async function markdownFiles(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) return markdownFiles(candidate);
      return entry.isFile() && entry.name.endsWith(".md") ? [candidate] : [];
    }),
  );
  return paths.flat().toSorted((left, right) => left.localeCompare(right));
}

const actionSafety = (operation: Action["operation"]): Action["safety"] => {
  if (["publish", "delete", "revoke"].includes(operation)) {
    return "irreversible";
  }
  return operation === "navigate" || operation === "click"
    ? "read-only"
    : "reversible";
};

const transitionFor = (
  operation: Action["operation"],
): Action["transition"] => {
  switch (operation) {
    case "submit":
    case "publish":
    case "delete":
    case "revoke":
    case "restore":
    case "retry":
      return operation;
    default:
      return "none";
  }
};

const actions = (): readonly Action[] =>
  ACTION_OPERATIONS.map((operation) => ({
    controlKey: `manifest:${operation}`,
    operation,
    safety: actionSafety(operation),
    transition: transitionFor(operation),
  }));

const seedProfiles = () =>
  SEED_PROFILES.map((profile) => {
    const manifest = SEED_PROFILE_MANIFESTS[profile];
    return {
      profile,
      definition: {
        purpose: manifest.purpose,
        capabilities: manifest.capabilities,
        stableIds: manifest.stableIds,
        counts: manifest.counts,
      },
    };
  });

const routeDeclarations = (catalogs: readonly Catalog[]) => {
  const routeKeys = catalogs.flatMap((catalog) => {
    const role = roleSchema.parse(catalog.role);
    return catalog.routes.map((route) => `${role}:${route.route}`);
  });
  assertRouteNetworkPolicyCoverage(routeKeys);
  return catalogs.flatMap((catalog) => {
    const role = roleSchema.parse(catalog.role);
    return catalog.routes.map((route) =>
      routeDeclarationFromCatalog(
        route,
        role,
        networkPolicyForRoute(role, route.route),
      ),
    );
  });
};

const toolVersions = () => ({
  node: process.version,
  playwright: command("pnpm", [
    "--filter",
    "@customreport/web",
    "exec",
    "playwright",
    "--version",
  ]),
  pnpm: command("pnpm", ["--version"]),
});

const exclusions = (): CampaignManifestInput["exclusions"] => [
  {
    id: "engine-firefox",
    scope: "browser",
    target: "firefox",
    reason: OWNER_BOUNDARY,
  },
  {
    id: "engine-webkit",
    scope: "browser",
    target: "webkit",
    reason: OWNER_BOUNDARY,
  },
  {
    id: "viewport-mobile",
    scope: "viewport",
    target: "mobile",
    reason: OWNER_BOUNDARY,
  },
  {
    id: "viewport-tablet",
    scope: "viewport",
    target: "tablet",
    reason: OWNER_BOUNDARY,
  },
];

const matrixDeclaration = (
  routes: CampaignManifestInput["routes"],
): CampaignManifestInput["matrixDeclaration"] => ({
  generatorSeed: "runtime-sweep-v1",
  axes: {
    role: CANONICAL_ROLES,
    route: routes.map(({ role, catalogRoute }) => `${role}:${catalogRoute}`),
    profileCapability: SEED_CAPABILITIES,
    lifecycle: LIFECYCLE_STATES,
    submission: SUBMISSION_STATES,
    ownershipDensity: OWNERSHIP_DENSITIES,
    permission: PERMISSION_BOUNDARIES,
    fault: FAULT_MODES,
    controlTransition: CONTROL_TRANSITIONS,
  },
  constraints: [
    {
      id: "role-route-reachability",
      reason: "A catalog route is applicable only to its declaring role",
    },
    {
      id: "seed-capability-availability",
      reason: "A state uses the smallest seed profile declaring its capability",
    },
  ],
});

async function domainSpecPaths(): Promise<readonly string[]> {
  const [durable, change] = await Promise.all([
    markdownFiles(path.join(REPO_ROOT, "openspec/specs")),
    markdownFiles(
      path.join(
        REPO_ROOT,
        "openspec/changes/establish-exhaustive-runtime-sweep/specs",
      ),
    ),
  ]);
  return [...durable, ...change];
}

export async function buildRuntimeManifestInput(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<CampaignManifestInput> {
  const catalogs = loadCatalogs();
  const routes = routeDeclarations(catalogs);
  const archiveRoot = path.resolve(
    requiredEnv(environment, "RUNTIME_SWEEP_ARCHIVE"),
  );
  const sourceValidationFileSha256 = optionalEnv(
    environment,
    "RUNTIME_SWEEP_SOURCE_VALIDATION_SHA256",
  );
  return {
    repoRoot: REPO_ROOT,
    outputPath: path.join(archiveRoot, "MANIFEST.json"),
    sourcePath: exactArchiveArtifactPath(
      archiveRoot,
      requiredEnv(environment, "RUNTIME_SWEEP_SOURCE"),
      "RUNTIME_SWEEP_SOURCE",
      "SOURCE.json",
    ),
    sourceValidationPath: exactArchiveArtifactPath(
      archiveRoot,
      requiredEnv(environment, "RUNTIME_SWEEP_SOURCE_VALIDATION"),
      "RUNTIME_SWEEP_SOURCE_VALIDATION",
      "SOURCE-VALIDATION.json",
    ),
    ...(sourceValidationFileSha256 === undefined
      ? {}
      : { sourceValidationFileSha256 }),
    preflightPath: path.join(archiveRoot, "PREFLIGHT.json"),
    campaignId: requiredEnv(environment, "RUNTIME_SWEEP_CAMPAIGN_ID"),
    sourceSha: requiredEnv(environment, "RUNTIME_SWEEP_SOURCE_SHA"),
    browser: "chromium",
    viewport: { browser: "chromium", width: 1440, height: 900 },
    roles: CANONICAL_ROLES,
    routes,
    profiles: SEED_PROFILES,
    seedProfiles: seedProfiles(),
    stateKinds: STATE_KINDS,
    actions: actions(),
    toolVersions: toolVersions(),
    catalogPaths: catalogs.map(({ role }) =>
      path.join(CATALOG_ROOT, `${role}.yaml`),
    ),
    domainSpecPaths: await domainSpecPaths(),
    matrixDeclaration: matrixDeclaration(routes),
    matrixLimits: {
      maxRevealMaterialEdges: DEFAULT_MAX_REVEAL_MATERIAL_EDGES,
      maxRevealActions: DEFAULT_MAX_REVEAL_ACTIONS,
      maxControlsPerSegment: DEFAULT_MAX_CONTROLS_PER_SEGMENT,
      maxCases: DEFAULT_MAX_CASES,
    },
    exclusions: exclusions(),
  };
}

async function main(): Promise<void> {
  const input = await buildRuntimeManifestInput();
  await writeCampaignSource(input);
  console.log(`runtime-source PASS ${input.sourceSha}`);
}

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  void main().catch((error: unknown) => {
    console.error("[runtime-source] Failed:", error);
    process.exitCode = 1;
  });
}
