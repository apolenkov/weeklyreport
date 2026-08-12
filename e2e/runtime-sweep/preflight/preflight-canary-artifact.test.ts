import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { buildCampaignSource } from "../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../manifest/manifest-fixture.ts";
import { runBrowserPreflightSegment } from "./playwright-preflight.ts";
import {
  assertPreflightCanaryPassForSource,
  createPreflightCanaryFailure,
  createPreflightCanaryPass,
  parsePreflightCanaryArtifact,
  resolvePreflightCanarySelection,
  writePreflightCanaryArtifact,
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

describe("exact-state preflight canary artifact", () => {
  it("runs the same preparation/navigation/inventory/reveal segment and emits an immutable PASS", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("fixture has no states");
      const selection = resolvePreflightCanarySelection({
        source,
        selector: { stateId: state.stateId },
      });
      const currentUrl = vi.fn(() => "http://127.0.0.1:3205/");
      const prepare = vi.fn(() => {
        currentUrl.mockReturnValue("about:blank");
        return Promise.resolve();
      });
      const navigate = vi.fn((route: string) => {
        currentUrl.mockReturnValue(`http://127.0.0.1:3205${route}`);
        return Promise.resolve();
      });
      const result = await runBrowserPreflightSegment({
        source,
        state,
        harness: {
          expectedOrigin: "http://127.0.0.1:3205",
          prepare,
          navigate,
          currentUrl,
          inventory: () => Promise.resolve({ controls: [], issues: [] }),
        },
        resetRequired: true,
      });
      expect(prepare).toHaveBeenCalledWith(state, selection.route, true);
      expect(navigate).toHaveBeenCalledWith(selection.route.resolvedRoute);
      expect(result.segment.state.stateId).toBe(state.stateId);
      const pass = createPreflightCanaryPass({
        source,
        selection,
        segment: result.segment,
        capturedAt: "2026-08-12T00:00:00.000Z",
      });
      expect(pass.status).toBe("PASS");
      expect(parsePreflightCanaryArtifact(pass)).toEqual(pass);
    });
  });

  it("requires a matching PASS canary for a repair state and preserves FAIL status", async () => {
    await withSource((source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("fixture has no states");
      const selection = resolvePreflightCanarySelection({
        source,
        selector: { stateId: state.stateId },
      });
      const failure = createPreflightCanaryFailure({
        source,
        selection,
        phase: "navigation",
        error: new Error("route did not settle"),
        capturedAt: "2026-08-12T00:00:00.000Z",
      });
      expect(() =>
        assertPreflightCanaryPassForSource({
          source,
          canary: failure,
          stateId: state.stateId,
        }),
      ).toThrow("not PASS");
    });
  });

  it("writes one immutable artifact and refuses overwrite", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("fixture has no states");
      const selection = resolvePreflightCanarySelection({
        source,
        selector: { stateId: state.stateId },
      });
      const pass = createPreflightCanaryPass({
        source,
        selection,
        segment: { state, controls: [], specialized: [] },
        capturedAt: "2026-08-12T00:00:00.000Z",
      });
      const root = await mkdtemp(path.join(tmpdir(), "runtime-canary-"));
      try {
        const artifactPath = path.join(root, "PREFLIGHT_CANARY.json");
        await writePreflightCanaryArtifact(artifactPath, pass);
        expect(JSON.parse(await readFile(artifactPath, "utf8"))).toEqual(pass);
        await expect(
          writePreflightCanaryArtifact(artifactPath, pass),
        ).rejects.toThrow("Cannot create immutable campaign manifest");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });
});
