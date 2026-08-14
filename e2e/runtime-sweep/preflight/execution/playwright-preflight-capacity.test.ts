import { rm } from "node:fs/promises";

import type { Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

const preflightMocks = vi.hoisted(() => ({
  createPlaywrightRevealExecutor: vi.fn(),
  inventoryDom: vi.fn(),
}));

vi.mock("../../replay/dom/dom-inventory.ts", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../replay/dom/dom-inventory.ts")
  >()),
  inventoryDom: preflightMocks.inventoryDom,
}));
vi.mock("./playwright-reveal-execution.ts", () => ({
  createPlaywrightRevealExecutor: preflightMocks.createPlaywrightRevealExecutor,
}));

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
import {
  runBrowserPreflightSegment,
  runPlaywrightPreflightSegment,
} from "./playwright-preflight.ts";

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

  it("keeps full initial settle separate from reveal replay settle", async () => {
    const { fixture, source } = await sourceWithCapacity({});
    try {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const initialInventory = inventoryFor([buttonFor(0)]);
      const events: string[] = [];
      let currentUrl = `${ORIGIN}/`;
      const waitForLoadState = vi.fn((loadState: string) => {
        events.push(`load:${loadState}`);
        return Promise.resolve();
      });
      const waitForFunction = vi.fn(() => {
        events.push("app-ready");
        return Promise.resolve();
      });
      const goto = vi.fn((route: string) => {
        events.push(`goto:${route}`);
        currentUrl = new URL(route, ORIGIN).toString();
        return Promise.resolve({ status: () => 200 });
      });
      const page = {
        url: () => currentUrl,
        goto,
        waitForURL: vi.fn(() => Promise.resolve()),
        waitForLoadState,
        waitForFunction,
      } as unknown as Page;
      preflightMocks.inventoryDom.mockResolvedValue(initialInventory);
      preflightMocks.createPlaywrightRevealExecutor.mockReturnValue(() =>
        Promise.resolve({
          url: currentUrl,
          inventory: inventoryFor([]),
          nonMutation: {
            status: "unchanged" as const,
            beforeDigest: DATABASE_DIGEST,
            afterDigest: DATABASE_DIGEST,
          },
        }),
      );

      const result = await runPlaywrightPreflightSegment({
        source,
        state,
        page,
        expectedOrigin: ORIGIN,
        prepare: () =>
          Promise.resolve({
            proveNonMutation: async (action: () => Promise<void>) => {
              await action();
              return {
                status: "unchanged" as const,
                beforeDigest: DATABASE_DIGEST,
                afterDigest: DATABASE_DIGEST,
              };
            },
          }),
        resetRequired: true,
      });

      expect(result.segment.controls.length).toBeGreaterThan(0);
      expect(waitForLoadState).toHaveBeenCalledOnce();
      expect(waitForLoadState).toHaveBeenCalledWith("networkidle", {
        timeout: 3000,
      });
      expect(goto).toHaveBeenCalledTimes(2);
      expect(waitForFunction).toHaveBeenCalledTimes(4);
      expect(
        events.filter((event) => event === "load:networkidle"),
      ).toHaveLength(1);
    } finally {
      preflightMocks.inventoryDom.mockReset();
      preflightMocks.createPlaywrightRevealExecutor.mockReset();
      await rm(fixture.root, { recursive: true, force: true });
    }
  });
});
