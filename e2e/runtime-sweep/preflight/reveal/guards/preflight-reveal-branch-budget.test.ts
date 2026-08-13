import { describe, expect, it } from "vitest";

import { state } from "../../../matrix/finalization/matrix-finalizer-fixtures.ts";
import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import { preflightControlForPlan } from "../../execution/playwright-preflight.ts";
import { revealSurfaceFor } from "../../reveal-path.ts";
import {
  discoverRevealControls,
  type RevealExecutionHarness,
} from "../interaction/preflight-reveal-discovery.ts";
import { revealSurfaceMaterialFor } from "./reveal-surface-material.ts";
const ROUTE = "/lead/report";
const ROOT_URL = "http://127.0.0.1:3205/lead/report";
const DATABASE_DIGEST = "d".repeat(64);
const observation = (
  controlKey: string,
  accessibleName: string,
  order: number,
): DomControlObservation => ({
  controlKey,
  domOrderKey: `${String(order).padStart(4, "0")}:${controlKey}`,
  order,
  role: "button",
  accessibleName,
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
});
const inventoryFor = (controls: readonly DomControlObservation[]) => ({
  controls,
  issues: [],
});

type Result = Readonly<{ url: string; inventory: DomInventory }>;
type Candidate = readonly [string, string, string, DomInventory?];
type Results = ReadonlyMap<string, Result>;
const harnessFor = (root: DomInventory, results: Results) => {
  const recorded: string[] = [];
  let currentUrl = ROOT_URL;
  const harness: RevealExecutionHarness = {
    prepare: () => (recorded.push("prepare"), Promise.resolve()),
    navigate: () => (
      (currentUrl = ROOT_URL),
      recorded.push("navigate"),
      Promise.resolve()
    ),
    currentUrl: () => currentUrl,
    inventory: () => Promise.resolve(root),
    executeReveal: ({ action }) => {
      recorded.push(`execute:${action.controlKey}`);
      const result = results.get(action.controlKey);
      if (result === undefined)
        throw new Error(`Missing result: ${action.controlKey}`);
      currentUrl = result.url;
      return Promise.resolve({
        ...result,
        nonMutation: {
          status: "unchanged" as const,
          beforeDigest: DATABASE_DIGEST,
          afterDigest: DATABASE_DIGEST,
        },
      });
    },
  };
  return {
    events: () => recorded,
    harness,
  };
};
const fixtureFor = (candidates: readonly Candidate[]) => {
  const root = inventoryFor(
    candidates.map(([key, name], order) => observation(key, name, order)),
  );
  const results = new Map(
    candidates.map(
      ([key, , url, inventory]) =>
        [key, { url, inventory: inventory ?? root }] as const,
    ),
  );
  return { root, ...harnessFor(root, results) };
};
const expectExecuted = (
  fixture: ReturnType<typeof fixtureFor>,
  keys: readonly string[],
) =>
  expect(
    fixture.events().filter((event) => event.startsWith("execute:")),
  ).toEqual(keys.map((key) => `execute:${key}`));
const discover = (
  initialInventory: DomInventory,
  harness: RevealExecutionHarness,
) =>
  discoverRevealControls({
    state: state(),
    route: { resolvedRoute: ROUTE },
    initialInventory,
    harness,
    controlFor: preflightControlForPlan,
    maxBranches: 1,
  });
describe("reveal branch budget", () => {
  it("does not spend the budget on a no-op and freezes both executed transitions", async () => {
    const noopKey = "button:a-noop:0";
    const materialKey = "button:b-open:0";
    const destination = inventoryFor([]);
    const fixture = fixtureFor([
      [noopKey, "Inspect", ROOT_URL],
      [materialKey, "Open panel", `${ROOT_URL}?panel=open`, destination],
    ]);
    const controls = await discover(fixture.root, fixture.harness);
    expectExecuted(fixture, [noopKey, materialKey]);
    const cells = [noopKey, materialKey].map((controlKey) =>
      controls.find((control) => control.controlKey === controlKey),
    );
    expect(
      cells.every(
        (control) =>
          control?.expectedActionTransition !== null &&
          control?.expectedActionSurface !== null,
      ),
    ).toBe(true);
    expect(
      cells.map((control) => control?.expectedActionTransition?.afterUrl),
    ).toEqual([ROUTE, `${ROUTE}?panel=open`]);
  });
  it("executes the second material candidate before rejecting the branch bound", async () => {
    const firstKey = "button:a-first:0";
    const secondKey = "button:b-second:0";
    const destination = inventoryFor([]);
    const fixture = fixtureFor([
      [firstKey, "Open first", `${ROOT_URL}?first=1`, destination],
      [secondKey, "Open second", `${ROOT_URL}?second=1`, destination],
    ]);
    await expect(discover(fixture.root, fixture.harness)).rejects.toThrow(
      /branch bound/iu,
    );
    expectExecuted(fixture, [firstKey, secondKey]);
  });

  it("does not spend a branch on a pure positional shift before a material branch", async () => {
    const shiftKey = "button:a-shift:0";
    const materialKey = "button:b-material:0";
    const shifted = inventoryFor([
      observation(shiftKey, "Shift controls", 11),
      observation(materialKey, "Material panel", 12),
    ]);
    const destination = inventoryFor([]);
    const fixture = fixtureFor([
      [shiftKey, "Shift controls", ROOT_URL, shifted],
      [materialKey, "Material panel", `${ROOT_URL}?panel=open`, destination],
    ]);

    const controls = await discover(fixture.root, fixture.harness);
    expectExecuted(fixture, [shiftKey, materialKey]);
    const shift = controls.find(({ controlKey }) => controlKey === shiftKey);
    expect(shift?.expectedActionSurface).not.toBeNull();
    expect(shift?.expectedActionSurface?.digest).toBe(
      revealSurfaceFor(shifted.controls).digest,
    );
    expect(
      revealSurfaceMaterialFor(revealSurfaceFor(fixture.root.controls)).digest,
    ).toBe(revealSurfaceMaterialFor(revealSurfaceFor(shifted.controls)).digest);
  });
});
