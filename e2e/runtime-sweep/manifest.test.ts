import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { campaignManifestSchema } from "./contracts.ts";
import {
  buildCampaignManifest,
  type CampaignManifestInput,
  type ManifestCommandRunner,
  writeCampaignManifest,
} from "./manifest.ts";

const SOURCE_SHA = "a".repeat(40);
const TREE_SHA = "b".repeat(40);

const fakeGit = (): ManifestCommandRunner => (args) => {
  const command = args.join(" ");
  if (command === "status --porcelain=v1 --untracked-files=all")
    return Promise.resolve("");
  if (command === "rev-parse --verify HEAD")
    return Promise.resolve(`${SOURCE_SHA}\n`);
  if (command === "rev-parse --verify HEAD^{tree}")
    return Promise.resolve(`${TREE_SHA}\n`);
  return Promise.reject(new Error(`Unexpected git command: ${command}`));
};

function definition() {
  return {
    purpose: "Deterministic runtime sweep fixture",
    capabilities: ["canonical-identities"] as const,
    stableIds: { activeReport: "report-1" },
    counts: {
      users: { min: 1, max: 2 },
      projects: { min: 1, max: 2 },
      reports: { min: 1, max: 2 },
      sections: { min: 1, max: 2 },
      items: { min: 1, max: 2 },
    },
  };
}

async function fixture(): Promise<{
  readonly root: string;
  readonly input: CampaignManifestInput;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "runtime-manifest-"));
  const catalogPath = path.join(root, "catalog.yaml");
  const specPath = path.join(root, "spec.md");
  await writeFile(catalogPath, "role: lead\nroutes:\n", "utf8");
  await writeFile(specPath, "# runtime sweep\n", "utf8");
  const profiles = ["minimal", "demo", "full", "stress"] as const;
  const input: CampaignManifestInput = {
    repoRoot: root,
    outputPath: path.join(root, "MANIFEST.json"),
    campaignId: "campaign-1",
    sourceSha: SOURCE_SHA,
    browser: "chromium",
    viewport: { browser: "chromium", width: 1440, height: 900 },
    roles: ["lead", "head", "admin", "viewer"],
    routes: [
      { role: "lead", catalogRoute: "/lead", resolvedRoute: "/lead" },
      { role: "head", catalogRoute: "/head", resolvedRoute: "/head" },
      { role: "admin", catalogRoute: "/admin", resolvedRoute: "/admin" },
      { role: "viewer", catalogRoute: "/reports", resolvedRoute: "/reports" },
    ],
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
    matrixDeclaration: {
      generatorSeed: "fixed",
      axes: {
        role: ["lead"],
        route: ["/lead"],
        profileCapability: ["canonical-identities"],
        lifecycle: ["open"],
        submission: ["draft"],
        ownershipDensity: ["single"],
        permission: ["allowed"],
        fault: ["none"],
        controlTransition: ["none"],
      },
      constraints: [],
    },
    exclusions: [
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
    ],
  };
  return { root, input };
}

describe("runtime sweep campaign manifest", () => {
  it("builds an immutable deterministic SHA-bound manifest", async () => {
    const { root, input } = await fixture();
    try {
      const first = await buildCampaignManifest(input, fakeGit());
      const second = await buildCampaignManifest(input, fakeGit());
      expect(second).toEqual(first);
      expect(Object.isFrozen(first)).toBe(true);
      expect(first.sourceSha).toBe(SOURCE_SHA);
      expect(first.treeDigest).toMatch(/^[0-9a-f]{64}$/u);
      expect(first.seedProfiles).toHaveLength(4);
      expect(first.matrixDigest).toMatch(/^[0-9a-f]{64}$/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a dirty worktree and malformed source SHA before writing", async () => {
    const { root, input } = await fixture();
    try {
      const dirtyGit: ManifestCommandRunner = (args) => {
        if (args[0] === "status")
          return Promise.resolve(" M apps/web/src/app/page.tsx\n");
        return Promise.reject(new Error("git should stop at dirty status"));
      };
      await expect(buildCampaignManifest(input, dirtyGit)).rejects.toThrow(
        "worktree is not clean",
      );
      await expect(
        buildCampaignManifest(
          { ...input, sourceSha: "A".repeat(40) },
          fakeGit(),
        ),
      ).rejects.toThrow("exactly 40 lowercase hexadecimal");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("writes canonical JSON once and refuses an overwrite", async () => {
    const { root, input } = await fixture();
    try {
      await writeCampaignManifest(input, fakeGit());
      const text = await readFile(input.outputPath, "utf8");
      expect(text.endsWith("\n")).toBe(true);
      expect(campaignManifestSchema.parse(JSON.parse(text)).sourceSha).toBe(
        SOURCE_SHA,
      );
      await expect(writeCampaignManifest(input, fakeGit())).rejects.toThrow(
        "Cannot create immutable campaign manifest",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("changes source-input digests when catalog content changes", async () => {
    const { root, input } = await fixture();
    try {
      const first = await buildCampaignManifest(input, fakeGit());
      const catalogPath = input.catalogPaths.at(0);
      if (catalogPath === undefined)
        throw new Error("catalog fixture is empty");
      await writeFile(
        catalogPath,
        "role: lead\nroutes:\nchanged: true\n",
        "utf8",
      );
      const second = await buildCampaignManifest(input, fakeGit());
      expect(second.catalogDigest).not.toBe(first.catalogDigest);
      expect(second.domainSpecDigest).toBe(first.domainSpecDigest);
      expect(second.matrixDigest).toBe(first.matrixDigest);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
