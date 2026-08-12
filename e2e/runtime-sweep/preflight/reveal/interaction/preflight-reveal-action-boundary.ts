import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import type { Action } from "../../../source/contracts.ts";
import { stableSerialize } from "../../../support/ids.ts";
import { type RevealSurface, revealSurfaceFor } from "../../reveal-path.ts";
import {
  assertSameRevealOrigin,
  requiredCurrentUrl,
} from "../guards/preflight-reveal-guards.ts";
import {
  RevealDiscoveryError,
  type RevealExecutionHarness,
} from "./preflight-reveal-types.ts";

type ExpectedRevealBoundary = Readonly<{
  readonly inventory: DomInventory;
  readonly surface: RevealSurface;
  readonly url: string;
}>;

type LiveRevealBoundary = Readonly<{
  readonly control: DomControlObservation;
  readonly rawUrl: string;
}>;

const controlForAction = (
  inventory: DomInventory,
  action: Action,
): DomControlObservation => {
  const control = inventory.controls.find(
    ({ controlKey }) => controlKey === action.controlKey,
  );
  if (control === undefined)
    throw new RevealDiscoveryError(
      `Reveal action control is absent from current inventory: ${action.controlKey}`,
    );
  if (!control.enabled)
    throw new RevealDiscoveryError(
      `Reveal action control is disabled: ${action.controlKey}`,
    );
  if (action.target !== undefined && control.href !== action.target.href)
    throw new RevealDiscoveryError(
      `Reveal action target changed for ${action.controlKey}`,
    );
  return control;
};

const assertLiveSurface = (
  expected: RevealSurface,
  inventory: DomInventory,
  controlKey: string,
): void => {
  const actual = revealSurfaceFor(inventory.controls);
  if (stableSerialize(actual) !== stableSerialize(expected))
    throw new RevealDiscoveryError(
      `Reveal action surface drifted immediately before execution: ${controlKey}`,
    );
};

export const liveRevealActionBoundary = async (
  harness: RevealExecutionHarness,
  expected: ExpectedRevealBoundary,
  action: Action,
): Promise<LiveRevealBoundary> => {
  const rawUrl = harness.currentUrl();
  const url = requiredCurrentUrl(rawUrl);
  if (url !== expected.url)
    throw new RevealDiscoveryError(
      `Reveal action URL drifted immediately before execution: ${action.controlKey}`,
    );
  const inventory = await harness.inventory();
  assertLiveSurface(expected.surface, inventory, action.controlKey);
  return { control: controlForAction(inventory, action), rawUrl };
};

export const liveRevealExecutionUrl = (
  harness: RevealExecutionHarness,
  reportedUrl: string,
  beforeRawUrl: string,
): string => {
  const liveRawUrl = harness.currentUrl();
  assertSameRevealOrigin(beforeRawUrl, liveRawUrl);
  assertSameRevealOrigin(reportedUrl, liveRawUrl);
  const reported = requiredCurrentUrl(reportedUrl);
  const live = requiredCurrentUrl(liveRawUrl);
  if (reported !== live)
    throw new RevealDiscoveryError(
      `Reveal executor URL disagrees with live current URL: reported=${reported} live=${live}`,
    );
  return live;
};
