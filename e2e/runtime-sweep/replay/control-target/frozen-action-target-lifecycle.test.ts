import type { Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import {
  input,
  state,
} from "../../matrix/finalization/matrix-finalizer-fixtures.ts";
import { finalizeCampaignMatrix } from "../../matrix/matrix-finalizer.ts";
import { revealPathFor } from "../../preflight/reveal-path.ts";
import type { DomInventory } from "../dom/dom-inventory.ts";
import {
  replayFrozenRevealPath,
  resolveFrozenRevealPreparation,
} from "../frozen-reveal/frozen-reveal-replay.ts";
import { selectFrozenActionTarget } from "./frozen-action-target.ts";
import {
  afterFirstExpansionSurface,
  afterSecondExpansionFromPostFirstSurface,
  afterSecondExpansionFromRootSurface,
  controlFor,
  executableControlCaseFor,
  fakePage,
  FIRST_SHOW_KEY,
  firstExpansionPath,
  postFirstExpansionInventory,
  postFirstSecondAction,
  postFirstSecondTransition,
  preflightControlFor,
  proof,
  rootInventory,
  rootSecondAction,
  rootSecondTransition,
  rootSurface,
  SECOND_SHOW_KEY,
  sourceFor,
} from "./frozen-action-target-lifecycle-fixtures.ts";

describe("frozen action target matrix lifecycle", () => {
  it("replays a finalized root case and resolves the exact second sibling", async () => {
    const path = revealPathFor([], "/lead");
    const matrix = finalizeCampaignMatrix(
      input({
        preflight: [
          {
            state: state(),
            controls: [
              preflightControlFor(
                controlFor(rootInventory, SECOND_SHOW_KEY),
                rootSecondAction,
                path,
                rootSurface,
                afterSecondExpansionFromRootSurface,
                rootSecondTransition,
              ),
            ],
          },
        ],
      }),
    );
    const matrixCase = executableControlCaseFor(matrix, SECOND_SHOW_KEY);
    if (!("action" in matrixCase.execution))
      throw new Error("Finalized root case lost its action");
    const page = fakePage([
      "https://runtime.invalid/lead",
      "https://runtime.invalid/lead",
      "https://runtime.invalid/lead",
    ]);
    const inventory = vi.fn().mockResolvedValue(rootInventory);
    const resolved = resolveFrozenRevealPreparation(
      sourceFor(path, [rootSurface]),
      matrixCase,
    );
    if (resolved === undefined)
      throw new Error("Finalized root preparation was not resolved");

    await expect(
      replayFrozenRevealPath({
        page,
        preparation: resolved,
        inventory,
        execute: vi.fn(),
        proveNonMutation: vi.fn(),
        cleanup: vi.fn(),
      }),
    ).resolves.toEqual({
      actionCount: 0,
      finalUrl: "/lead",
      finalSurfaceDigest: rootSurface.digest,
    });

    expect(
      selectFrozenActionTarget(
        rootInventory.controls,
        matrixCase.execution.action,
      ),
    ).toBe(rootInventory.controls[1]);
  });

  it("replays a finalized path-A case and resolves the shifted sibling from its post-action surface", async () => {
    const matrix = finalizeCampaignMatrix(
      input({
        preflight: [
          {
            state: state(),
            controls: [
              preflightControlFor(
                controlFor(rootInventory, SECOND_SHOW_KEY),
                rootSecondAction,
                revealPathFor([], "/lead"),
                rootSurface,
                afterSecondExpansionFromRootSurface,
                rootSecondTransition,
              ),
              preflightControlFor(
                controlFor(postFirstExpansionInventory, FIRST_SHOW_KEY),
                postFirstSecondAction,
                firstExpansionPath,
                afterFirstExpansionSurface,
                afterSecondExpansionFromPostFirstSurface,
                postFirstSecondTransition,
              ),
            ],
          },
        ],
      }),
    );
    const matrixCase = executableControlCaseFor(matrix, FIRST_SHOW_KEY);
    if (!("action" in matrixCase.execution))
      throw new Error("Finalized post-action case lost its action");

    const resolved = resolveFrozenRevealPreparation(
      sourceFor(firstExpansionPath, [rootSurface, afterFirstExpansionSurface]),
      matrixCase,
    );
    if (resolved === undefined)
      throw new Error("Finalized post-action preparation was not resolved");

    const page = fakePage([
      "https://runtime.invalid/lead",
      "https://runtime.invalid/lead",
      "https://runtime.invalid/lead",
      "https://runtime.invalid/lead",
      "https://runtime.invalid/lead",
    ]);
    const inventory = vi
      .fn<(currentPage: Page) => Promise<DomInventory>>()
      .mockResolvedValueOnce(rootInventory)
      .mockResolvedValueOnce(postFirstExpansionInventory)
      .mockResolvedValue(postFirstExpansionInventory);
    const execute = vi.fn(() => Promise.resolve({ status: "pass" as const }));
    const proveNonMutation = vi.fn(async (step: () => Promise<void>) => {
      await step();
      return proof;
    });

    await expect(
      replayFrozenRevealPath({
        page,
        preparation: resolved,
        inventory,
        execute,
        proveNonMutation,
        cleanup: vi.fn(),
      }),
    ).resolves.toEqual({
      actionCount: 1,
      finalUrl: "/lead",
      finalSurfaceDigest: afterFirstExpansionSurface.digest,
    });

    const finalInventory = await inventory(page);
    expect(
      selectFrozenActionTarget(
        finalInventory.controls,
        matrixCase.execution.action,
      ),
    ).toBe(finalInventory.controls[1]);
    expect(execute).toHaveBeenCalledOnce();
    expect(proveNonMutation).toHaveBeenCalledOnce();
  });
});
