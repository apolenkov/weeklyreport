import { access, readFile, rm } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { writePreflightArtifact } from "../preflight/artifacts/preflight-artifact.ts";
import {
  assertSpecializedNominalTargets,
  runBrowserPreflight,
} from "../preflight/execution/playwright-preflight.ts";
import { preflightSessionGroupKey } from "../preflight/runtime/preflight-session.ts";
import { campaignManifestSchema } from "../source/contracts.ts";
import { cleanSourceIdentity } from "../source/manifest-source.ts";
import { writeRuntimeSourceValidationReceipt } from "../source/runtime-source-validation.ts";
import { sha256Hex } from "../support/ids.ts";
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
  FIXTURE_TREE_SHA,
} from "./manifest-fixture.ts";

const routeAwareNavigation = (): Readonly<{
  readonly navigate: (route: string) => Promise<void>;
  readonly currentUrl: () => string;
}> => {
  const browserUrl = (route: string): string =>
    new URL(route, "http://127.0.0.1:3205").href;
  const currentUrl = vi.fn(() => browserUrl("/"));
  return {
    navigate: (route) => {
      currentUrl.mockReturnValue(browserUrl(route));
      return Promise.resolve();
    },
    currentUrl,
  };
};

async function writePreflightFixture(
  input: CampaignManifestInput,
): Promise<CampaignManifestInput> {
  const source = await buildCampaignSource(input, fakeManifestGit());
  await writeCampaignSource(input, fakeManifestGit());
  if (
    input.sourcePath === undefined ||
    input.sourceValidationPath === undefined
  )
    throw new Error("Source validation fixture paths are required");
  const receiptFile = await writeRuntimeSourceValidationReceipt({
    sourcePath: input.sourcePath,
    receiptPath: input.sourceValidationPath,
    expectedSource: source,
  });
  const navigation = routeAwareNavigation();
  const preflight = await runBrowserPreflight({
    source,
    harness: {
      expectedOrigin: "http://127.0.0.1:3205",
      prepare: () => Promise.resolve(),
      ...navigation,
      inventory: () => Promise.resolve({ controls: [], issues: [] }),
    },
  });
  if (input.preflightPath === undefined)
    throw new Error("Preflight fixture path is required");
  await writePreflightArtifact(input.preflightPath, preflight);
  return {
    ...input,
    sourceValidationFileSha256: receiptFile.receiptFileSha256,
  };
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

async function groupsStatePreparationBySeedTarget(): Promise<void> {
  await withFixture(async ({ input }) => {
    const source = await buildCampaignSource(input, fakeManifestGit());
    const groups: string[] = [];
    const navigation = routeAwareNavigation();
    await runBrowserPreflight({
      source,
      harness: {
        expectedOrigin: "http://127.0.0.1:3205",
        prepare: (state, route) => {
          const target = route.target === "published" ? "published" : "active";
          const group = `${state.profile}:${target}`;
          if (groups.at(-1) !== group) groups.push(group);
          return Promise.resolve();
        },
        ...navigation,
        inventory: () => Promise.resolve({ controls: [], issues: [] }),
      },
    });

    expect(groups).toEqual([...new Set(groups)]);
  });
}

async function groupsStatePreparationBySessionActor(): Promise<void> {
  await withFixture(async ({ input }) => {
    const source = await buildCampaignSource(input, fakeManifestGit());
    const groups: string[] = [];
    const visits: Parameters<typeof preflightSessionGroupKey>[] = [];
    const navigation = routeAwareNavigation();
    await runBrowserPreflight({
      source,
      harness: {
        expectedOrigin: "http://127.0.0.1:3205",
        prepare: (state, route) => {
          visits.push([state, route]);
          const group = preflightSessionGroupKey(state, route);
          if (groups.at(-1) !== group) groups.push(group);
          return Promise.resolve();
        },
        ...navigation,
        inventory: () => Promise.resolve({ controls: [], issues: [] }),
      },
    });

    expect(groups).toEqual([...new Set(groups)]);
    expect(groups.length).toBeLessThan(source.plan.states.length);
    const [state, route] = visits.at(0) ?? [];
    if (state === undefined || route === undefined)
      throw new Error("Manifest fixture has no preflight visits");
    const key = preflightSessionGroupKey(state, route);
    const lifecycle = state.axes.lifecycle === "open" ? "published" : "open";
    const permission =
      state.axes.permission === "anonymous" ? "allowed" : "anonymous";
    expect(
      preflightSessionGroupKey(
        { ...state, axes: { ...state.axes, lifecycle } },
        route,
      ),
    ).toBe(key);
    expect(
      preflightSessionGroupKey(
        { ...state, axes: { ...state.axes, permission } },
        route,
      ),
    ).not.toBe(key);
    expect(
      preflightSessionGroupKey(state, {
        ...route,
        target: route.target === "published" ? "active" : "published",
      }),
    ).not.toBe(key);
  });
}

async function buildsDeterministicManifest(): Promise<void> {
  await withFixture(async ({ input }) => {
    const validatedInput = await writePreflightFixture(input);
    const git = fakeManifestGit();
    const first = await buildCampaignManifest(validatedInput, git);
    const second = await buildCampaignManifest(validatedInput, git);
    const identity = await cleanSourceIdentity(validatedInput, git);
    expect(second).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(first.sourceSha).toBe(FIXTURE_SOURCE_SHA);
    expect(first.sourceTree).toBe(FIXTURE_TREE_SHA);
    expect(identity.sourceTree).toBe(first.sourceTree);
    expect(identity.treeDigest).toBe(first.treeDigest);
    expect(first.treeDigest).toBe(
      sha256Hex({ sourceSha: FIXTURE_SOURCE_SHA, tree: FIXTURE_TREE_SHA }),
    );
    expect(first.treeDigest).toMatch(/^[0-9a-f]{64}$/u);
    expect(first.seedProfiles).toHaveLength(4);
    expect(first.matrixDigest).toMatch(/^[0-9a-f]{64}$/u);
  });
}

async function rejectsDirtyOrMismatchedSource(): Promise<void> {
  await withFixture(async ({ input }) => {
    const validatedInput = await writePreflightFixture(input);
    const dirtyGit: ManifestCommandRunner = (args) =>
      args[0] === "status"
        ? Promise.resolve(" M apps/web/src/app/page.tsx\n")
        : Promise.reject(new Error("git should stop at dirty status"));
    await expect(
      buildCampaignManifest(validatedInput, dirtyGit),
    ).rejects.toThrow("worktree is not clean");
    await expect(
      buildCampaignManifest(
        { ...validatedInput, sourceSha: "A".repeat(40) },
        fakeManifestGit(),
      ),
    ).rejects.toThrow("Source SHA must be exactly 40 lowercase");

    const changedTreeGit: ManifestCommandRunner = (args, cwd) => {
      if (args.join(" ") === "rev-parse --verify HEAD^{tree}")
        return Promise.resolve(`${"c".repeat(40)}\n`);
      return fakeManifestGit()(args, cwd);
    };
    await expect(
      buildCampaignManifest(validatedInput, changedTreeGit),
    ).rejects.toThrow("canonical source builder output");
  });
}

async function writesOnce(): Promise<void> {
  await withFixture(async ({ input }) => {
    const validatedInput = await writePreflightFixture(input);
    await writeCampaignManifest(validatedInput, fakeManifestGit());
    const text = await readFile(input.outputPath, "utf8");
    expect(text.endsWith("\n")).toBe(true);
    expect(campaignManifestSchema.parse(JSON.parse(text)).sourceSha).toBe(
      FIXTURE_SOURCE_SHA,
    );
    expect(campaignManifestSchema.parse(JSON.parse(text)).sourceTree).toBe(
      FIXTURE_TREE_SHA,
    );
    await expect(
      writeCampaignManifest(validatedInput, fakeManifestGit()),
    ).rejects.toThrow("Cannot atomically create campaign artifacts");
  });
}

async function refusesMissingPreflight(): Promise<void> {
  await withFixture(async ({ root, input }) => {
    const source = await writeCampaignSource(input, fakeManifestGit());
    if (
      input.sourcePath === undefined ||
      input.sourceValidationPath === undefined
    )
      throw new Error("Source validation fixture paths are required");
    const receiptFile = await writeRuntimeSourceValidationReceipt({
      sourcePath: input.sourcePath,
      receiptPath: input.sourceValidationPath,
      expectedSource: source,
    });
    await expect(
      writeCampaignManifest(
        {
          ...input,
          sourceValidationFileSha256: receiptFile.receiptFileSha256,
        },
        fakeManifestGit(),
      ),
    ).rejects.toThrow("Cannot read PREFLIGHT.json");
    await expect(access(path.join(root, "MATRIX.json"))).rejects.toThrow();
  });
}

async function refusesMissingCurrentUrl(): Promise<void> {
  await withFixture(async ({ input }) => {
    const source = await buildCampaignSource(input, fakeManifestGit());
    const harness = {
      expectedOrigin: "http://127.0.0.1:3205",
      prepare: () => Promise.resolve(),
      navigate: () => Promise.resolve(),
      inventory: () => Promise.resolve({ controls: [], issues: [] }),
    } as unknown as Parameters<typeof runBrowserPreflight>[0]["harness"];
    await expect(runBrowserPreflight({ source, harness })).rejects.toThrow(
      "Browser preflight current URL callback is not configured",
    );
  });
}

describe("runtime sweep campaign manifest", () => {
  it(
    "proves a nominal target for every specialized declaration",
    provesNominalTargets,
  );
  it(
    "groups state preparation by the underlying seed target",
    groupsStatePreparationBySeedTarget,
  );
  it(
    "orders exact actor session groups contiguously",
    groupsStatePreparationBySessionActor,
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
  it(
    "refuses to start preflight without a live current URL",
    refusesMissingCurrentUrl,
  );
  it("writes canonical JSON once and refuses an overwrite", writesOnce);
});
