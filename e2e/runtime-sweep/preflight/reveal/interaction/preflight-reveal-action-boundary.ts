import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import type { Action } from "../../../source/contracts.ts";
import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import {
  type RevealSurface,
  type RevealSurfaceControl,
  revealSurfaceFor,
} from "../../reveal-path.ts";
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

const SURFACE_DIFF_ENTRY_LIMIT = 8;
const SURFACE_FIELDS = [
  "ariaRole",
  "accessibleName",
  "enabled",
  "order",
  "domOrderKey",
  "href",
  "interactionEffect",
  "disclosureIndependence",
] as const satisfies readonly Exclude<
  keyof RevealSurfaceControl,
  "controlKey"
>[];

const changedSurfaceFields = (
  expected: RevealSurfaceControl,
  actual: RevealSurfaceControl,
): readonly (typeof SURFACE_FIELDS)[number][] =>
  SURFACE_FIELDS.filter((field) => expected[field] !== actual[field]);

const boundedSurfaceDiff = (
  expected: RevealSurface,
  actual: RevealSurface,
): string => {
  const expectedByKey = new Map(
    expected.controls.map((control) => [control.controlKey, control] as const),
  );
  const actualByKey = new Map(
    actual.controls.map((control) => [control.controlKey, control] as const),
  );
  const added = actual.controls
    .filter(({ controlKey }) => !expectedByKey.has(controlKey))
    .map(({ controlKey }) => sha256Hex(controlKey));
  const removed = expected.controls
    .filter(({ controlKey }) => !actualByKey.has(controlKey))
    .map(({ controlKey }) => sha256Hex(controlKey));
  const changed = expected.controls.flatMap((expectedControl) => {
    const actualControl = actualByKey.get(expectedControl.controlKey);
    if (actualControl === undefined) return [];
    const fields = changedSurfaceFields(expectedControl, actualControl);
    return fields.length === 0
      ? []
      : [`${sha256Hex(expectedControl.controlKey)}:fields=${fields.join(",")}`];
  });
  const truncated = [added, removed, changed].some(
    (entries) => entries.length > SURFACE_DIFF_ENTRY_LIMIT,
  );
  return [
    `expectedCount=${expected.controls.length}`,
    `actualCount=${actual.controls.length}`,
    `expectedDigest=${expected.digest}`,
    `actualDigest=${actual.digest}`,
    `added=[${added.slice(0, SURFACE_DIFF_ENTRY_LIMIT).join(",")}]`,
    `removed=[${removed.slice(0, SURFACE_DIFF_ENTRY_LIMIT).join(",")}]`,
    `changed=[${changed.slice(0, SURFACE_DIFF_ENTRY_LIMIT).join(";")}]`,
    `truncated=${String(truncated)}`,
  ].join(" ");
};

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
      `Reveal action surface drifted immediately before execution: actionKeyDigest=${sha256Hex(controlKey)} ${boundedSurfaceDiff(expected, actual)}`,
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
