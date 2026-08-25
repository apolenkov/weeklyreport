import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");

const ENTRYPOINT_EFFECTS = {
  "e2e/runtime-sweep/preflight/run-runtime-preflight.ts": [
    "assertE2eRuntimeDestructiveTarget(",
    "ensurePreflightArchiveRoot(",
    "runPreflightPlaywrightChild(",
  ],
  "e2e/runtime-sweep/preflight/run-runtime-preflight-diagnostic.ts": [
    "ensurePreflightArchiveRoot(",
    "assertE2eRuntimeDestructiveTarget(",
    "runControlledDiagnostic(",
  ],
  "e2e/runtime-sweep/preflight/run-runtime-capacity-survey.ts": [
    "assertE2eRuntimeDestructiveTarget(",
    "capacitySurveyPaths(",
  ],
  "e2e/runtime-sweep/preflight/run-runtime-failure-frontier-replay.ts": [
    "assertE2eRuntimeDestructiveTarget(",
    "runPreflightFailureFrontierReplayChild(",
  ],
  "e2e/runtime-sweep/preflight/playwright.config.ts": [
    "assertE2eRuntimeDestructiveTarget(",
    "defineConfig(",
  ],
  "e2e/runtime-sweep/preflight/playwright.preflight.config.ts": [
    "assertE2eRuntimeDestructiveTarget(",
    "defineConfig(",
  ],
  "e2e/runtime-sweep/manifest/finalize-runtime-manifest.ts": [
    "writeCampaignManifest(",
  ],
  "e2e/runtime-sweep/evidence/finalize-runtime-coverage-cli.ts": [
    "finalizeRuntimeCoverage(",
  ],
  "e2e/runtime-sweep/driver/import-ai-driver-cli.ts": [
    "importAiDriverReports(",
  ],
  "e2e/runtime-sweep/lanes/plan-runtime-lanes-cli.ts": [
    "planRuntimeLanes(",
    "mkdir(",
  ],
  "e2e/runtime-sweep/lanes/prepare-runtime-lane-infrastructure-cli.ts": [
    "assertE2eRuntimeDestructiveTarget(",
    "prepareRuntimeLaneInfrastructure(",
  ],
  "e2e/runtime-sweep/lanes/run-runtime-lanes-cli.ts": [
    "assertE2eRuntimeDestructiveTarget(",
    "runRuntimeLanes(",
  ],
  "e2e/runtime-sweep/lanes/merge-runtime-lanes-cli.ts": ["mergeRuntimeLanes("],
} as const;

const firstCall = (source: string, token: string): number => {
  const index = source.indexOf(token);
  if (index === -1) throw new Error(`Expected call is missing: ${token}`);
  return index;
};

const listTypeScriptFiles = async (
  root: string,
): Promise<readonly string[]> => {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry): Promise<readonly string[]> => {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory()) return listTypeScriptFiles(entryPath);
      return entry.isFile() && entry.name.endsWith(".ts") ? [entryPath] : [];
    }),
  );
  return nested.flat();
};

describe("runtime source authority boundary", () => {
  it("places canonical authority before every runtime entrypoint effect", async () => {
    await Promise.all(
      Object.entries(ENTRYPOINT_EFFECTS).map(async ([filePath, effects]) => {
        const source = await readFile(path.join(REPO_ROOT, filePath), "utf8");
        const authority = firstCall(
          source,
          "await assertRuntimeSourceAuthorityFromEnvironment(",
        );
        effects.forEach((effect) =>
          expect(authority).toBeLessThan(firstCall(source, effect)),
        );
      }),
    );
  });

  it("keeps raw SOURCE readers out of production consumers", async () => {
    const runtimeRoot = path.join(REPO_ROOT, "e2e", "runtime-sweep");
    const productionFiles = (await listTypeScriptFiles(runtimeRoot)).filter(
      (filePath) => !filePath.endsWith(".test.ts"),
    );
    const rawReaders = (
      await Promise.all(
        productionFiles.map(async (filePath) => ({
          filePath: path.relative(REPO_ROOT, filePath),
          source: await readFile(filePath, "utf8"),
        })),
      )
    )
      .filter(({ source }) => source.includes("readSourceArtifact"))
      .map(({ filePath }) => filePath)
      .sort();

    expect(rawReaders).toEqual(["e2e/runtime-sweep/source/source-artifact.ts"]);
  });
});
