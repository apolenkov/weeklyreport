import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { ACTIVE_REPORT_ID } from "../../prisma/seed-constants.ts";
import {
  type CampaignManifestInput,
  type ManifestCommandRunner,
} from "./manifest.ts";

const SHA_LENGTH = 40;
export const FIXTURE_SOURCE_SHA = "a".repeat(SHA_LENGTH);
const FIXTURE_TREE_SHA = "b".repeat(SHA_LENGTH);

export const fakeManifestGit = (): ManifestCommandRunner => (args) => {
  const command = args.join(" ");
  if (command === "status --porcelain=v1 --untracked-files=all")
    return Promise.resolve("");
  if (command === "rev-parse --verify HEAD")
    return Promise.resolve(`${FIXTURE_SOURCE_SHA}\n`);
  if (command === "rev-parse --verify HEAD^{tree}")
    return Promise.resolve(`${FIXTURE_TREE_SHA}\n`);
  return Promise.reject(new Error(`Unexpected git command: ${command}`));
};

const definition = () => ({
  purpose: "Deterministic runtime sweep fixture",
  capabilities: [
    "canonical-identities",
    "editable-active-report",
    "published-period",
  ] as const,
  stableIds: { activeReport: "report-1" },
  counts: {
    users: { min: 1, max: 2 },
    projects: { min: 1, max: 2 },
    reports: { min: 1, max: 2 },
    sections: { min: 1, max: 2 },
    items: { min: 1, max: 2 },
  },
});

const fixtureRoutes = () => [
  { role: "lead" as const, catalogRoute: "/lead", resolvedRoute: "/lead" },
  {
    role: "lead" as const,
    catalogRoute: "/lead/report/[reportId]",
    resolvedRoute: `/lead/report/${ACTIVE_REPORT_ID}`,
  },
  { role: "head" as const, catalogRoute: "/head", resolvedRoute: "/head" },
  {
    role: "head" as const,
    catalogRoute: "/head/report/[reportId]",
    resolvedRoute: `/head/report/${ACTIVE_REPORT_ID}`,
  },
  { role: "admin" as const, catalogRoute: "/admin", resolvedRoute: "/admin" },
  {
    role: "viewer" as const,
    catalogRoute: "/reports",
    resolvedRoute: "/reports",
  },
];

const matrixDeclaration = (): CampaignManifestInput["matrixDeclaration"] => ({
  generatorSeed: "fixed",
  axes: {
    role: ["lead", "head", "admin", "viewer"],
    route: [
      "lead:/lead",
      "lead:/lead/report/[reportId]",
      "head:/head",
      "head:/head/report/[reportId]",
      "admin:/admin",
      "viewer:/reports",
    ],
    profileCapability: [
      "canonical-identities",
      "editable-active-report",
      "published-period",
    ],
    lifecycle: ["open"],
    submission: ["draft"],
    ownershipDensity: ["single"],
    permission: ["allowed"],
    fault: ["none"],
    controlTransition: ["none"],
  },
  constraints: [],
});

const exclusions = (): CampaignManifestInput["exclusions"] => [
  {
    id: "exclude-firefox",
    scope: "browser",
    target: "firefox",
    reason: "Chromium-only campaign",
  },
  {
    id: "exclude-webkit",
    scope: "browser",
    target: "webkit",
    reason: "Chromium-only campaign",
  },
  {
    id: "exclude-mobile",
    scope: "viewport",
    target: "mobile",
    reason: "Desktop viewport only",
  },
  {
    id: "exclude-tablet",
    scope: "viewport",
    target: "tablet",
    reason: "Desktop viewport only",
  },
];

const inputFor = (
  root: string,
  catalogPath: string,
  specPath: string,
): CampaignManifestInput => {
  const profiles = ["minimal", "demo", "full", "stress"] as const;
  return {
    repoRoot: root,
    outputPath: path.join(root, "MANIFEST.json"),
    sourcePath: path.join(root, "SOURCE.json"),
    preflightPath: path.join(root, "PREFLIGHT.json"),
    campaignId: "campaign-1",
    sourceSha: FIXTURE_SOURCE_SHA,
    browser: "chromium",
    viewport: { browser: "chromium", width: 1440, height: 900 },
    roles: ["lead", "head", "admin", "viewer"],
    routes: fixtureRoutes(),
    profiles,
    seedProfiles: profiles.map((profile) => ({
      profile,
      definition: definition(),
    })),
    stateKinds: ["nominal", "boundary", "lifecycle", "permission", "fault"],
    actions: [
      {
        controlKey: "route",
        operation: "navigate",
        safety: "read-only",
        transition: "none",
      },
    ],
    toolVersions: { node: "26.0.0", pnpm: "11.17.0", playwright: "1.62.0" },
    catalogPaths: [catalogPath],
    domainSpecPaths: [specPath],
    matrixDeclaration: matrixDeclaration(),
    matrixLimits: { maxCases: 10_000, maxControlsPerSegment: 128 },
    exclusions: exclusions(),
  };
};

export async function createManifestFixture(): Promise<{
  readonly root: string;
  readonly input: CampaignManifestInput;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "runtime-manifest-"));
  const catalogPath = path.join(root, "catalog.yaml");
  const specPath = path.join(root, "spec.md");
  await writeFile(catalogPath, "role: lead\nroutes:\n", "utf8");
  await writeFile(specPath, "# runtime sweep\n", "utf8");
  return { root, input: inputFor(root, catalogPath, specPath) };
}
