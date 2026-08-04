import { access, readFile, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { campaignManifestSchema } from "./contracts.ts";
import {
  buildCampaignManifest,
  buildCampaignSource,
  type CampaignManifestInput,
  type ManifestCommandRunner,
  writeCampaignManifest,
  writeCampaignSource,
} from "./manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
  FIXTURE_SOURCE_SHA,
} from "./manifest-fixture.ts";
import {
  assertSpecializedNominalTargets,
  runBrowserPreflight,
} from "./playwright-preflight.ts";
import { writePreflightArtifact } from "./preflight-artifact.ts";

async function writePreflightFixture(
  input: CampaignManifestInput,
): Promise<void> {
  const source = await buildCampaignSource(input, fakeManifestGit());
  await writeCampaignSource(input, fakeManifestGit());
  const preflight = await runBrowserPreflight({
    source,
    harness: {
      prepare: () => Promise.resolve(),
      navigate: () => Promise.resolve(),
      inventory: () => Promise.resolve({ controls: [], issues: [] }),
    },
  });
  if (input.preflightPath === undefined)
    throw new Error("Preflight fixture path is required");
  await writePreflightArtifact(input.preflightPath, preflight);
}

async function withFixture(
  callback: (
    fixture: Awaited<ReturnType<typeof createManifestFixture>>,
  ) => Promise<void>,
): Promise<void> {
  const fixture = await createManifestFixture();
  try {
    await callback(fixture);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
}

async function provesNominalTargets(): Promise<void> {
  await withFixture(async ({ input }) => {
    const source = await buildCampaignSource(input, fakeManifestGit());
    expect(() => assertSpecializedNominalTargets(source)).not.toThrow();
  });
}

async function buildsDeterministicManifest(): Promise<void> {
  await withFixture(async ({ input }) => {
    await writePreflightFixture(input);
    const first = await buildCampaignManifest(input, fakeManifestGit());
    const second = await buildCampaignManifest(input, fakeManifestGit());
    expect(second).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(first.sourceSha).toBe(FIXTURE_SOURCE_SHA);
    expect(first.treeDigest).toMatch(/^[0-9a-f]{64}$/u);
    expect(first.seedProfiles).toHaveLength(4);
    expect(first.matrixDigest).toMatch(/^[0-9a-f]{64}$/u);
  });
}

async function rejectsDirtyOrMismatchedSource(): Promise<void> {
  await withFixture(async ({ input }) => {
    await writePreflightFixture(input);
    const dirtyGit: ManifestCommandRunner = (args) =>
      args[0] === "status"
        ? Promise.resolve(" M apps/web/src/app/page.tsx\n")
        : Promise.reject(new Error("git should stop at dirty status"));
    await expect(buildCampaignManifest(input, dirtyGit)).rejects.toThrow(
      "worktree is not clean",
    );
    await expect(
      buildCampaignManifest(
        { ...input, sourceSha: "A".repeat(40) },
        fakeManifestGit(),
      ),
    ).rejects.toThrow("SOURCE.json does not match manifest inputs");
  });
}

async function writesOnce(): Promise<void> {
  await withFixture(async ({ input }) => {
    await writePreflightFixture(input);
    await writeCampaignManifest(input, fakeManifestGit());
    const text = await readFile(input.outputPath, "utf8");
    expect(text.endsWith("\n")).toBe(true);
    expect(campaignManifestSchema.parse(JSON.parse(text)).sourceSha).toBe(
      FIXTURE_SOURCE_SHA,
    );
    await expect(
      writeCampaignManifest(input, fakeManifestGit()),
    ).rejects.toThrow("Cannot atomically create campaign artifacts");
  });
}

async function refusesMissingPreflight(): Promise<void> {
  await withFixture(async ({ root, input }) => {
    await writeCampaignSource(input, fakeManifestGit());
    await expect(
      writeCampaignManifest(input, fakeManifestGit()),
    ).rejects.toThrow("Cannot read PREFLIGHT.json");
    await expect(access(path.join(root, "MATRIX.json"))).rejects.toThrow();
  });
}

async function preservesFrozenSourceDigest(): Promise<void> {
  await withFixture(async ({ input }) => {
    await writePreflightFixture(input);
    const first = await buildCampaignManifest(input, fakeManifestGit());
    const catalogPath = input.catalogPaths.at(0);
    if (catalogPath === undefined) throw new Error("catalog fixture is empty");
    await writeFile(
      catalogPath,
      "role: lead\nroutes:\nchanged: true\n",
      "utf8",
    );
    const second = await buildCampaignManifest(input, fakeManifestGit());
    expect(second.catalogDigest).toBe(first.catalogDigest);
    expect(second.domainSpecDigest).toBe(first.domainSpecDigest);
    expect(second.matrixDigest).toBe(first.matrixDigest);
  });
}

describe("runtime sweep campaign manifest", () => {
  it(
    "proves a nominal target for every specialized declaration",
    provesNominalTargets,
  );
  it(
    "builds an immutable deterministic SHA-bound manifest",
    buildsDeterministicManifest,
  );
  it(
    "rejects a dirty worktree and mismatched source",
    rejectsDirtyOrMismatchedSource,
  );
  it("refuses to create MATRIX without PREFLIGHT", refusesMissingPreflight);
  it("writes canonical JSON once and refuses an overwrite", writesOnce);
  it(
    "preserves the frozen source digest after input files change",
    preservesFrozenSourceDigest,
  );
});
