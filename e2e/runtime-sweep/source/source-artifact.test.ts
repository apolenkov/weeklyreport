import { rm } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  buildCampaignSource,
  parseSourceArtifact,
} from "../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../manifest/manifest-fixture.ts";
import {
  assertPreflightMatchesSource,
  readPreflightArtifact,
  writePreflightArtifact,
} from "../preflight/artifacts/preflight-artifact.ts";
import { runBrowserPreflight } from "../preflight/execution/playwright-preflight.ts";
import { sha256Hex } from "../support/ids.ts";

const routeAwareNavigation = (): Readonly<{
  readonly navigate: (route: string) => Promise<void>;
  readonly currentUrl: () => string;
}> => {
  const browserUrl = (route: string): string =>
    new URL(route, "http://127.0.0.1:3205").href;
  let currentUrl = browserUrl("/");
  return {
    navigate: (route) => {
      currentUrl = browserUrl(route);
      return Promise.resolve();
    },
    currentUrl: () => currentUrl,
  };
};

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

async function writePreflightFixture(
  input: Awaited<ReturnType<typeof createManifestFixture>>["input"],
): Promise<void> {
  const source = await buildCampaignSource(input, fakeManifestGit());
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

describe("runtime sweep source artifact identity", () => {
  it("rejects legacy and tampered source trees", async () => {
    await withFixture(async ({ input }) => {
      const source = await buildCampaignSource(input, fakeManifestGit());
      const { sourceTree: _sourceTree, ...legacySource } = source;
      expect(() => parseSourceArtifact(legacySource)).toThrow();

      const { sourceDigest: _sourceDigest, ...sourceBody } = source;
      const tamperedBody = { ...sourceBody, sourceTree: "c".repeat(40) };
      expect(() =>
        parseSourceArtifact({
          ...tamperedBody,
          sourceDigest: sha256Hex(tamperedBody),
        }),
      ).not.toThrow();
      expect(() =>
        parseSourceArtifact({
          ...tamperedBody,
          sourceDigest: source.sourceDigest,
        }),
      ).toThrow("digest does not match contents");
    });
  });

  it("binds preflight to sourceTree through sourceDigest", async () => {
    await withFixture(async ({ input }) => {
      await writePreflightFixture(input);
      const source = await buildCampaignSource(input, fakeManifestGit());
      if (input.preflightPath === undefined)
        throw new Error("Preflight fixture path is required");
      const preflight = await readPreflightArtifact(input.preflightPath);
      expect(preflight.sourceDigest).toBe(source.sourceDigest);

      const { sourceDigest: _sourceDigest, ...sourceBody } = source;
      const tamperedBody = { ...sourceBody, sourceTree: "c".repeat(40) };
      const tamperedSource = parseSourceArtifact({
        ...tamperedBody,
        sourceDigest: sha256Hex(tamperedBody),
      });
      expect(() =>
        assertPreflightMatchesSource(tamperedSource, preflight),
      ).toThrow("PREFLIGHT.json does not match SOURCE.json");
    });
  });
});
