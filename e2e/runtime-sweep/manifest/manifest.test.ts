import { access, readFile, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  assertSpecializedNominalTargets,
  runBrowserPreflight,
} from "../preflight/playwright-preflight.ts";
import { writePreflightArtifact } from "../preflight/preflight-artifact.ts";
import { preflightSessionGroupKey } from "../preflight/preflight-session.ts";
import { campaignManifestSchema } from "../source/contracts.ts";
import { cleanSourceIdentity } from "../source/manifest-source.ts";
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
): Promise<void> {
  const source = await buildCampaignSource(input, fakeManifestGit());
  await writeCampaignSource(input, fakeManifestGit());
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
    await writePreflightFixture(input);
    const first = await buildCampaignManifest(input, fakeManifestGit());
    const second = await buildCampaignManifest(input, fakeManifestGit());
    const identity = await cleanSourceIdentity(input, fakeManifestGit());
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

    const changedTreeGit: ManifestCommandRunner = (args, cwd) => {
      if (args.join(" ") === "rev-parse --verify HEAD^{tree}")
        return Promise.resolve(`${"c".repeat(40)}\n`);
      return fakeManifestGit()(args, cwd);
    };
    await expect(buildCampaignManifest(input, changedTreeGit)).rejects.toThrow(
      "source tree does not match",
    );
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
    expect(campaignManifestSchema.parse(JSON.parse(text)).sourceTree).toBe(
      FIXTURE_TREE_SHA,
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
  it(
    "preserves the frozen source digest after input files change",
    preservesFrozenSourceDigest,
  );
});
