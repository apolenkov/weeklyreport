import type { Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import type { RuntimeMatrixSource } from "../../matrix/runtime-matrix.ts";
import {
  type RevealNonMutationProof,
  revealPathFor,
  revealStepFor,
  type RevealSurfaceControl,
  revealSurfaceFor,
} from "../../preflight/reveal-path.ts";
import type { DomInventory } from "../dom/dom-inventory.ts";
import { matrixCase } from "../test-fixtures/frozen-case-live-runner.test-fixture.ts";
import {
  replayFrozenRevealPath,
  resolveFrozenRevealPreparation,
} from "./frozen-reveal-replay.ts";
import { assertFrozenRevealTarget } from "./frozen-reveal-target.ts";

const rootControl: RevealSurfaceControl = {
  controlKey: "button:Open:1",
  ariaRole: "button",
  accessibleName: "Open",
  enabled: true,
  order: 1,
  domOrderKey: "0001:button:Open:1",
  href: null,
  interactionEffect: null,
};

const targetControl: RevealSurfaceControl = {
  controlKey: "button:After:1",
  ariaRole: "button",
  accessibleName: "After",
  enabled: true,
  order: 2,
  domOrderKey: "0002:button:After:1",
  href: null,
  interactionEffect: null,
};

const rootSurface = revealSurfaceFor([rootControl]);
const targetSurface = revealSurfaceFor([rootControl, targetControl]);
const proof: RevealNonMutationProof = {
  status: "unchanged",
  beforeDigest: "d".repeat(64),
  afterDigest: "d".repeat(64),
};
const revealPath = revealPathFor(
  [
    revealStepFor(
      {
        controlKey: rootControl.controlKey,
        operation: "click",
        safety: "read-only",
        transition: "open",
      },
      rootSurface,
      targetSurface,
      "/reports",
      "/reports?panel=open",
      proof,
    ),
  ],
  "/reports",
);

const caseWithPreparation = (preparation: {
  readonly revealPathDigest: string;
  readonly expectedSurfaceDigest: string;
  readonly expectedActionTransitionDigest?: string | null;
}) => ({
  ...matrixCase,
  controlKey: targetControl.controlKey,
  preparation: { expectedActionTransitionDigest: null, ...preparation },
});

const sourceFor = (
  path = revealPath,
  surface = targetSurface,
): RuntimeMatrixSource =>
  ({
    matrix: { revealPaths: [path], revealSurfaces: [surface] },
  }) as unknown as RuntimeMatrixSource;

const sourceWithRegistries = (
  paths: readonly (typeof revealPath)[],
  surfaces: readonly (typeof targetSurface)[],
): RuntimeMatrixSource =>
  ({
    matrix: { revealPaths: paths, revealSurfaces: surfaces },
  }) as unknown as RuntimeMatrixSource;

const inventoryFor = (
  controls: readonly RevealSurfaceControl[],
): DomInventory => ({
  controls: controls.map((control) => ({
    controlKey: control.controlKey,
    domOrderKey: control.domOrderKey,
    order: control.order,
    role: control.ariaRole,
    accessibleName: control.accessibleName,
    enabled: control.enabled,
    disabled: !control.enabled,
    visible: true,
    tagName: control.ariaRole === "link" ? "a" : "button",
    inputType: null,
    href: control.href,
  })),
  issues: [],
});

const fakePage = (urls: readonly string[]): Page =>
  ({
    url: urls.reduce((mock, value) => mock.mockReturnValueOnce(value), vi.fn()),
  }) as unknown as Page;

const replayInputFor = (overrides: {
  readonly page?: Page;
  readonly inventories?: readonly DomInventory[];
  readonly proof?: RevealNonMutationProof;
}) => {
  const inventory = vi.fn();
  (
    overrides.inventories ?? [
      inventoryFor([rootControl]),
      inventoryFor([rootControl, targetControl]),
    ]
  ).forEach((value) => inventory.mockResolvedValueOnce(value));
  return {
    page:
      overrides.page ??
      fakePage([
        "https://runtime.invalid/reports",
        "https://runtime.invalid/reports",
        "https://runtime.invalid/reports?panel=open",
        "https://runtime.invalid/reports?panel=open",
        "https://runtime.invalid/reports?panel=open",
      ]),
    preparation: { path: revealPath, surface: targetSurface },
    inventory,
    execute: vi.fn(() => Promise.resolve({ status: "pass" as const })),
    proveNonMutation: vi.fn(async (action: () => Promise<void>) => {
      await action();
      return overrides.proof ?? proof;
    }),
    settle: vi.fn(() => Promise.resolve()),
    cleanup: vi.fn(() => Promise.resolve()),
  };
};

describe("frozen reveal runtime replay", () => {
  it("replays the frozen path and compares the final state", async () => {
    const input = replayInputFor({});

    await expect(replayFrozenRevealPath(input)).resolves.toEqual({
      actionCount: 1,
      finalUrl: "/reports?panel=open",
      finalSurfaceDigest: targetSurface.digest,
    });
    expect(input.execute).toHaveBeenCalledOnce();
    expect(input.proveNonMutation).toHaveBeenCalledOnce();
    expect(input.cleanup).not.toHaveBeenCalled();
  });

  it("fails closed when a registry reference is missing", () => {
    expect(() =>
      resolveFrozenRevealPreparation(
        sourceFor(),
        caseWithPreparation({
          revealPathDigest: "a".repeat(64),
          expectedSurfaceDigest: targetSurface.digest,
        }),
      ),
    ).toThrow(/unresolved reveal preparation/u);
  });

  it("fails closed on duplicate or digest-invalid registry entries", () => {
    const preparation = caseWithPreparation({
      revealPathDigest: revealPath.digest,
      expectedSurfaceDigest: targetSurface.digest,
    });
    expect(() =>
      resolveFrozenRevealPreparation(
        sourceWithRegistries([revealPath, revealPath], [targetSurface]),
        preparation,
      ),
    ).toThrow(/duplicate reveal paths/u);
    expect(() =>
      resolveFrozenRevealPreparation(
        sourceWithRegistries(
          [{ ...revealPath, digest: "a".repeat(64) }],
          [targetSurface],
        ),
        preparation,
      ),
    ).toThrow(/digest does not match/u);
  });

  it("cleans the event collector on URL drift", async () => {
    const input = replayInputFor({
      page: fakePage(["https://runtime.invalid/reports?drift=true"]),
    });

    await expect(replayFrozenRevealPath(input)).rejects.toThrow(/initial URL/u);
    expect(input.cleanup).toHaveBeenCalledOnce();
  });

  it("rejects surface drift after a reveal action", async () => {
    const input = replayInputFor({
      inventories: [
        inventoryFor([rootControl]),
        inventoryFor([{ ...targetControl, accessibleName: "Changed" }]),
      ],
    });

    await expect(replayFrozenRevealPath(input)).rejects.toThrow(
      /after surface drift/u,
    );
    expect(input.cleanup).toHaveBeenCalledOnce();
  });

  it("rejects database proof drift", async () => {
    const input = replayInputFor({
      proof: { ...proof, afterDigest: "e".repeat(64) },
    });

    await expect(replayFrozenRevealPath(input)).rejects.toThrow(
      /database after proof drift/u,
    );
    expect(input.cleanup).toHaveBeenCalledOnce();
  });

  it("rejects a missing live target and a changed target signature", () => {
    expect(() =>
      assertFrozenRevealTarget(inventoryFor([]), rootControl),
    ).toThrow(/target is missing/u);
    expect(() =>
      assertFrozenRevealTarget(inventoryFor([rootControl]), {
        ...rootControl,
        accessibleName: "Changed",
      }),
    ).toThrow(/signature drift/u);
  });
});
