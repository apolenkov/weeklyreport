import {
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
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

const HOST_CHECKPOINT_ROOT_ENV = "RUNTIME_SWEEP_PREFLIGHT_HOST_CHECKPOINT_ROOT";
const HOST_CHECKPOINT_ROOT_ENV_ALLOWLIST = new Set([
  "e2e/runtime-sweep/preflight/run-runtime-preflight.ts",
  "e2e/runtime-sweep/preflight/launch/preflight-launcher-support.ts",
  "e2e/runtime-sweep/preflight/launch/preflight-launcher-support.test.ts",
  "e2e/runtime-sweep/preflight/launch/checkpoint/preflight-reveal-host-checkpoint-launch.ts",
  "e2e/runtime-sweep/preflight/launch/checkpoint/run-runtime-reveal-host-checkpoint-controller.ts",
]);

const runtimeSweepSourceFiles = async (
  directory: string,
): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) return runtimeSweepSourceFiles(absolute);
      if (!/\.(?:mjs|ts|tsx)$/u.test(entry.name)) return [];
      return [absolute];
    }),
  );
  return nested.flat();
};

describe("runtime preflight launcher boundaries", () => {
  it("keeps the host checkpoint root raw reader on the allowlisted parent path", async () => {
    const root = path.resolve(import.meta.dirname, "..", "..");
    const files = await runtimeSweepSourceFiles(root);
    const matches = (
      await Promise.all(
        files.map(async (file) =>
          (await readFile(file, "utf8")).includes(HOST_CHECKPOINT_ROOT_ENV)
            ? path.relative(path.resolve(root, "..", ".."), file)
            : undefined,
        ),
      )
    ).filter((file): file is string => file !== undefined);
    expect(matches.toSorted()).toEqual(
      [...HOST_CHECKPOINT_ROOT_ENV_ALLOWLIST].toSorted(),
    );
  });

  it("routes repair canaries through the parent and forbids child-authored PASS", async () => {
    const [launcher, child, parent, checkpointParent] = await Promise.all([
      readFile(
        path.resolve(import.meta.dirname, "..", "run-runtime-preflight.ts"),
        "utf8",
      ),
      readFile(
        path.resolve(import.meta.dirname, "..", "preflight-canary.spec.ts"),
        "utf8",
      ),
      readFile(
        path.resolve(
          import.meta.dirname,
          "preflight-reveal-continuation-parent.ts",
        ),
        "utf8",
      ),
      readFile(
        path.resolve(
          import.meta.dirname,
          "checkpoint",
          "preflight-reveal-host-checkpoint-parent.ts",
        ),
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
    const reduced = checkpointParent.indexOf(
      "const checkpoint = await requestHostCheckpointAfterChild",
    );
    const nextChild = checkpointParent.indexOf(
      "return runChildUntilDone({",
      reduced,
    );
    expect(reduced).toBeGreaterThan(-1);
    expect(nextChild).toBeGreaterThan(reduced);
    expect(
      checkpointParent.indexOf("if (result.done) return", reduced),
    ).toBeLessThan(reduced);
    expect(parent).not.toContain("requestHostCheckpointAfterChild");
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
            RUNTIME_SWEEP_PREFLIGHT_HOST_CHECKPOINT_ROOT: path.join(
              archiveRoot,
              "5.19-admin-demo",
              "host-checkpoints",
            ),
          },
          "canary",
        );
        expect(canaryEnvironment).not.toHaveProperty(
          "RUNTIME_SWEEP_PREFLIGHT_JOURNAL",
        );
        expect(canaryEnvironment).not.toHaveProperty(
          "RUNTIME_SWEEP_PREFLIGHT_HOST_CHECKPOINT_ROOT",
        );
        expect(canaryEnvironment).not.toHaveProperty(
          "RUNTIME_SWEEP_PREFLIGHT_HOST_CHECKPOINT_BASELINE_MANIFEST",
        );
        expect(canaryEnvironment).not.toHaveProperty(
          "RUNTIME_SWEEP_PREFLIGHT_HOST_CHECKPOINT_BASELINE_DIGEST",
        );
        expect(canaryEnvironment).not.toHaveProperty(
          "RUNTIME_SWEEP_PREFLIGHT_HOST_CONTROLLER_TIMEOUT_MS",
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
