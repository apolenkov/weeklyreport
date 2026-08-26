import { describe, expect, it, vi } from "vitest";

import type { DomInventory } from "../../../../replay/dom/dom-inventory.ts";
import type { RevealExecutionHarness } from "../preflight-reveal-types.ts";
import {
  boundaryHarnessFor,
  branchLocalFailureFixture as fixture,
  liveUrl,
  proof,
  restoreBranchLocallyForFailure as restore,
  terminalWithInventory,
  unusedHarness,
} from "./preflight-reveal-branch-local-restoration.test-support.ts";

describe("branch-local inverse restoration failures", () => {
  it.each(["missing", "duplicate", "disabled"] as const)(
    "rejects a %s inverse target before execution",
    async (variant) => {
      const input = fixture();
      const controls = input.pairInventory.controls;
      const candidate = controls[1];
      if (candidate === undefined) throw new Error("Candidate is missing");
      const inventory: DomInventory = {
        ...input.pairInventory,
        controls:
          variant === "missing"
            ? controls.slice(0, 1)
            : variant === "duplicate"
              ? [
                  ...controls,
                  { ...candidate, controlKey: `${candidate.controlKey}:copy` },
                ]
              : controls.map((control, index) =>
                  index === 1
                    ? { ...control, enabled: false, disabled: true }
                    : control,
                ),
      };

      await expect(
        restore(
          unusedHarness(),
          input,
          terminalWithInventory(input.terminal, inventory),
        ),
      ).rejects.toThrow(/inverse target is missing or ambiguous/iu);
    },
  );

  it.each([
    new Error("inverse execution timeout"),
    new DOMException("inverse execution aborted", "AbortError"),
  ])("propagates %s without accepting restored state", async (failure) => {
    const input = fixture();
    const harness: RevealExecutionHarness = {
      ...boundaryHarnessFor(input.pairInventory),
      executeReveal: () => Promise.reject(failure),
    };

    await expect(restore(harness, input)).rejects.toBe(failure);
  });

  it("rejects URL drift before inverse execution", async () => {
    const input = fixture();
    const executeReveal = vi.fn<RevealExecutionHarness["executeReveal"]>();
    const harness: RevealExecutionHarness = {
      ...boundaryHarnessFor(input.pairInventory),
      currentUrl: () => `${liveUrl}&drift=before`,
      executeReveal,
    };

    await expect(restore(harness, input)).rejects.toThrow(/URL drifted/iu);
    expect(executeReveal).not.toHaveBeenCalled();
  });

  it("rejects URL drift after inverse execution", async () => {
    const input = fixture();
    let currentUrl = liveUrl;
    const driftedUrl = `${liveUrl}&drift=after`;
    const harness: RevealExecutionHarness = {
      ...boundaryHarnessFor(input.pairInventory),
      currentUrl: () => currentUrl,
      executeReveal: () => {
        currentUrl = driftedUrl;
        return Promise.resolve({
          url: driftedUrl,
          inventory: input.sourceInventory,
          nonMutation: proof,
        });
      },
    };

    await expect(restore(harness, input)).rejects.toThrow(
      /did not restore the exact source branch/iu,
    );
  });

  it("rejects URL drift while the restored surface settles", async () => {
    const input = fixture();
    let currentUrl = liveUrl;
    let currentInventory = input.pairInventory;
    const harness: RevealExecutionHarness = {
      ...boundaryHarnessFor(input.pairInventory),
      currentUrl: () => currentUrl,
      inventory: () => Promise.resolve(currentInventory),
      executeReveal: () =>
        Promise.resolve({
          url: liveUrl,
          inventory: input.pairInventory,
          nonMutation: proof,
        }),
      waitForRevealSurfaceReady: () => {
        currentUrl = `${liveUrl}&drift=settle`;
        currentInventory = input.sourceInventory;
        return Promise.resolve();
      },
    };

    await expect(restore(harness, input)).rejects.toThrow(
      /executor URL disagrees with live current URL/iu,
    );
  });

  it("rejects database-oracle drift after inverse execution", async () => {
    const input = fixture();
    const harness: RevealExecutionHarness = {
      ...boundaryHarnessFor(input.pairInventory),
      executeReveal: () =>
        Promise.resolve({
          url: liveUrl,
          inventory: input.sourceInventory,
          nonMutation: { ...proof, afterDigest: "e".repeat(64) },
        }),
    };

    await expect(restore(harness, input)).rejects.toThrow(
      /unchanged database-oracle proof/iu,
    );
  });

  it("rejects restored surface drift", async () => {
    const input = fixture();
    const drifted: DomInventory = {
      ...input.sourceInventory,
      controls: input.sourceInventory.controls.map((control, index) =>
        index === 0 ? { ...control, enabled: false, disabled: true } : control,
      ),
    };
    const harness: RevealExecutionHarness = {
      ...boundaryHarnessFor(input.pairInventory),
      executeReveal: () =>
        Promise.resolve({
          url: liveUrl,
          inventory: drifted,
          nonMutation: proof,
        }),
    };

    await expect(restore(harness, input)).rejects.toThrow(
      /did not restore the exact source branch/iu,
    );
  });
});
