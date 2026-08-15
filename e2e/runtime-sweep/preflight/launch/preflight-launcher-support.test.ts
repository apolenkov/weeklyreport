import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { buildCampaignSource } from "../../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../../manifest/manifest-fixture.ts";
import { createPreflightAssignment } from "../artifacts/preflight-assignment.ts";
import {
  preflightChildEnvironment,
  preparePreflightFullPaths,
} from "./preflight-launcher-support.ts";
import { runPreflightRepairChain } from "./preflight-repair-chain.ts";

const withSource = async <T>(
  callback: (
    source: Awaited<ReturnType<typeof buildCampaignSource>>,
  ) => Promise<T> | T,
): Promise<T> => {
  const fixture = await createManifestFixture();
  try {
    return await callback(
      await buildCampaignSource(fixture.input, fakeManifestGit()),
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
};

describe("runtime preflight launcher boundaries", () => {
  it("routes repair canaries through the parent and forbids child-authored PASS", async () => {
    const [launcher, child] = await Promise.all([
      readFile(
        path.resolve(import.meta.dirname, "..", "run-runtime-preflight.ts"),
        "utf8",
      ),
      readFile(
        path.resolve(import.meta.dirname, "..", "preflight-canary.spec.ts"),
        "utf8",
      ),
    ]);
    expect(launcher).toMatch(/runCanary:\s*runRevealCanary/u);
    expect(launcher).not.toMatch(
      /runCanary:\s*\(\)\s*=>\s*runPlaywright\("canary"\)/u,
    );
    expect(child).toContain(
      "Preflight canary PASS requires the reveal continuation parent",
    );
    expect(child).not.toContain("createPreflightCanaryPass");
    expect(child).not.toContain("runPlaywrightPreflightSegment");
  });

  it("keeps canary independent of a stale journal and creates assignment before repair full", async () => {
    await withSource(async (source) => {
      const archiveRoot = await realpath(
        await mkdtemp(path.join(tmpdir(), "preflight-launcher-")),
      );
      const paths = {
        preflightPath: path.join(archiveRoot, "PREFLIGHT.json"),
        assignmentPath: path.join(archiveRoot, "PREFLIGHT_ASSIGNMENT.json"),
        journalPath: path.join(archiveRoot, "PREFLIGHT.journal.jsonl"),
        segmentRoot: path.join(archiveRoot, "segments"),
      } as const;
      try {
        await writeFile(paths.journalPath, "{invalid journal}\n", "utf8");
        const canaryEnvironment = preflightChildEnvironment(
          {
            RUNTIME_SWEEP_PREFLIGHT: paths.preflightPath,
            RUNTIME_SWEEP_PREFLIGHT_ASSIGNMENT: paths.assignmentPath,
            RUNTIME_SWEEP_PREFLIGHT_JOURNAL: paths.journalPath,
            RUNTIME_SWEEP_PREFLIGHT_SEGMENTS: paths.segmentRoot,
          },
          "canary",
        );
        expect(canaryEnvironment).not.toHaveProperty(
          "RUNTIME_SWEEP_PREFLIGHT_JOURNAL",
        );

        const events: string[] = [];
        await expect(
          runPreflightRepairChain({
            runCanary: () => {
              events.push("canary");
              return Promise.resolve(0);
            },
            readCanary: () => {
              events.push("read");
              return Promise.resolve("PASS");
            },
            assertCanary: () => {
              events.push("validate");
            },
            recheckSource: () => {
              events.push("recheck");
              return Promise.resolve();
            },
            runFull: async () => {
              events.push("full");
              const full = await preparePreflightFullPaths({
                archiveRoot,
                source,
                ...paths,
              });
              expect(await readFile(full.assignmentPath, "utf8")).toContain(
                createPreflightAssignment(source).assignmentDigest,
              );
              return 0;
            },
          }),
        ).resolves.toBe(0);
        expect(events).toEqual([
          "canary",
          "read",
          "validate",
          "recheck",
          "full",
        ]);
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });
});
