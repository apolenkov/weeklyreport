import { rm } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { buildCampaignSource } from "../../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../../manifest/manifest-fixture.ts";
import { runPreflightRepairChain } from "../launch/preflight-repair-chain.ts";
import {
  assertLivePreflightSourceIdentity,
  preflightCanarySelectorFromEnvironment,
  resolvePreflightCanarySelection,
} from "./preflight-canary.ts";

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

describe("exact-state preflight canary", () => {
  it("rechecks live source after PASS and immediately before full preflight", async () => {
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
          return Promise.reject(new Error("worktree changed during canary"));
        },
        runFull: () => {
          events.push("full");
          return Promise.resolve(0);
        },
      }),
    ).rejects.toThrow("worktree changed during canary");
    expect(events).toEqual(["canary", "read", "validate", "recheck"]);
  });

  it("rejects contradictory serialized and field selectors", () => {
    expect(() =>
      preflightCanarySelectorFromEnvironment({
        RUNTIME_SWEEP_CANARY_SELECTOR: JSON.stringify({ stateId: "state-a" }),
        RUNTIME_SWEEP_CANARY_STATE_ID: "state-b",
      }),
    ).toThrow("cannot be combined");
  });

  it("resolves one state and rejects confirming selector drift before browser work", async () => {
    await withSource((source) => {
      const state = source.plan.states.find(
        (candidate) => candidate.axes.route === "admin:/admin",
      );
      if (state === undefined) throw new Error("fixture has no admin state");
      const selection = resolvePreflightCanarySelection({
        source,
        selector: {
          stateId: state.stateId,
          role: "admin",
          route: "admin:/admin",
          profile: state.profile,
        },
      });
      expect(selection.state.stateId).toBe(state.stateId);
      expect(selection.route.resolvedRoute).toBe("/admin");
      expect(() =>
        resolvePreflightCanarySelection({
          source,
          selector: {
            stateId: state.stateId,
            role: "viewer",
            route: "admin:/admin",
            profile: state.profile,
          },
        }),
      ).toThrow("role does not match");
      expect(() =>
        resolvePreflightCanarySelection({
          source,
          selector: {
            stateId: state.stateId,
            role: "admin",
            route: "admin:/wrong",
            profile: state.profile,
          },
        }),
      ).toThrow("route does not match");
    });
  });

  it("rejects unknown, duplicate, and stale source identities without invoking a harness", async () => {
    await withSource((source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("fixture has no states");
      expect(() =>
        resolvePreflightCanarySelection({
          source,
          selector: { stateId: "state-does-not-exist" },
        }),
      ).toThrow("Unknown preflight canary stateId");
      expect(() =>
        resolvePreflightCanarySelection({
          source,
          selector: { stateId: state.stateId },
          expectedSourceSha: "b".repeat(40),
        }),
      ).toThrow("source SHA is stale");
      const duplicateSource = {
        ...source,
        plan: {
          ...source.plan,
          states: [...source.plan.states, state],
        },
      } as typeof source;
      expect(() =>
        resolvePreflightCanarySelection({
          source: duplicateSource,
          selector: { stateId: state.stateId },
        }),
      ).toThrow("duplicate state identity");
    });
  });

  it("rejects dirty, stale, or unbound live Git identity before browser work", async () => {
    await withSource(async (source) => {
      await expect(
        assertLivePreflightSourceIdentity({
          source,
          repoRoot: "/fixture",
          runCommand: fakeManifestGit(),
        }),
      ).resolves.toMatchObject({
        sourceSha: source.sourceSha,
        sourceTree: source.sourceTree,
        treeDigest: source.treeDigest,
      });
      await expect(
        assertLivePreflightSourceIdentity({
          source,
          repoRoot: "/fixture",
          runCommand: (args) =>
            args[0] === "status"
              ? Promise.resolve(" M source.ts\n")
              : fakeManifestGit()(args, "/fixture"),
        }),
      ).rejects.toThrow("requires a clean worktree");
      await expect(
        assertLivePreflightSourceIdentity({
          source,
          repoRoot: "/fixture",
          expectedSourceSha: "c".repeat(40),
          runCommand: fakeManifestGit(),
        }),
      ).rejects.toThrow("source SHA is stale");
    });
  });
});
