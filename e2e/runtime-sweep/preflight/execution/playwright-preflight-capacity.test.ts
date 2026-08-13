import { rm } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  buildCampaignSource,
  parseSourceArtifact,
} from "../../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../../manifest/manifest-fixture.ts";
import type { DomInventory } from "../../replay/dom/dom-inventory.ts";
import { sha256Hex } from "../../support/ids.ts";
import { runBrowserPreflightSegment } from "./playwright-preflight.ts";

const ORIGIN = "http://127.0.0.1:3205";
const DATABASE_DIGEST = "d".repeat(64);

const inventoryFor = (controls: DomInventory["controls"]): DomInventory => ({
  controls,
  issues: [],
});

const buttonFor = (index: number, enabled = true) => ({
  controlKey: `button:fixture-${index}`,
  domOrderKey: `${String(index).padStart(4, "0")}:button:fixture-${index}`,
  order: index,
  role: "button" as const,
  accessibleName: `Fixture ${index}`,
  enabled,
  disabled: !enabled,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
});

const sourceWithCapacity = async (overrides: {
  readonly maxRevealMaterialEdges?: number;
  readonly maxRevealActions?: number;
  readonly maxControlsPerSegment?: number;
}) => {
  const fixture = await createManifestFixture();
  const base = await buildCampaignSource(fixture.input, fakeManifestGit());
  const { sourceDigest: _sourceDigest, ...sourceBody } = base;
  const body = {
    ...sourceBody,
    matrixLimits: {
      ...base.matrixLimits,
      ...overrides,
    },
  };
  return {
    fixture,
    source: parseSourceArtifact({ ...body, sourceDigest: sha256Hex(body) }),
  };
};

const harnessFor = (initialInventory: DomInventory) => {
  let currentUrl = `${ORIGIN}/`;
  const executeReveal = ({
    action,
  }: {
    readonly action: { readonly controlKey: string };
  }) => {
    const pathname = new URL(currentUrl).pathname;
    currentUrl = `${ORIGIN}${pathname}?control=${encodeURIComponent(action.controlKey)}`;
    return Promise.resolve({
      url: currentUrl,
      inventory: inventoryFor([]),
      nonMutation: {
        status: "unchanged" as const,
        beforeDigest: DATABASE_DIGEST,
        afterDigest: DATABASE_DIGEST,
      },
    });
  };
  return {
    expectedOrigin: ORIGIN,
    prepare: () => Promise.resolve(),
    navigate: (route: string) => {
      currentUrl = `${ORIGIN}${route}`;
      return Promise.resolve();
    },
    currentUrl: () => currentUrl,
    inventory: () => Promise.resolve(initialInventory),
    executeReveal,
  };
};

describe("source-bound preflight capacity", () => {
  it("propagates the source material-edge cap instead of using a coupled default", async () => {
    const { fixture, source } = await sourceWithCapacity({
      maxRevealMaterialEdges: 1,
    });
    try {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const initialInventory = inventoryFor([buttonFor(0), buttonFor(1)]);
      await expect(
        runBrowserPreflightSegment({
          source,
          state,
          harness: harnessFor(initialInventory),
          resetRequired: true,
        }),
      ).rejects.toThrow("Reveal material edge bound exceeded");
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("propagates the source action cap independently from material edges", async () => {
    const { fixture, source } = await sourceWithCapacity({
      maxRevealActions: 1,
    });
    try {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const initialInventory = inventoryFor([buttonFor(0), buttonFor(1)]);
      await expect(
        runBrowserPreflightSegment({
          source,
          state,
          harness: harnessFor(initialInventory),
          resetRequired: true,
        }),
      ).rejects.toThrow("Reveal action bound exceeded");
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects a segment over the source control cap before returning a canary segment", async () => {
    const { fixture, source } = await sourceWithCapacity({
      maxControlsPerSegment: 128,
    });
    try {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const initialInventory = inventoryFor(
        Array.from({ length: 129 }, (_, index) => buttonFor(index, false)),
      );
      await expect(
        runBrowserPreflightSegment({
          source,
          state,
          harness: harnessFor(initialInventory),
          resetRequired: true,
        }),
      ).rejects.toThrow(/maxControlsPerSegment is 128/iu);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });
});
