import type {
  DomControlObservation,
  DomInventory,
} from "../../../replay/dom/dom-inventory.ts";
import type { Action } from "../../../source/contracts.ts";
import {
  revealPathFor,
  revealStepFor,
  type RevealSurface,
  revealSurfaceFor,
} from "../../reveal-path.ts";
import type { RevealBranch } from "../interaction/preflight-reveal-branches.ts";
import { pairReductionDiagnosisFor } from "./preflight-reveal-pair-diagnosis.ts";
import type { RevealReductionContext } from "./preflight-reveal-reduction-context.ts";

const SOURCE_SHA_LENGTH = 40;
const DIGEST_LENGTH = 64;

const unchanged = {
  status: "unchanged" as const,
  beforeDigest: "d".repeat(DIGEST_LENGTH),
  afterDigest: "d".repeat(DIGEST_LENGTH),
};

const controlFor = (
  key: string,
  target: string,
  expanded: boolean,
): DomControlObservation => ({
  controlKey: key,
  domOrderKey: `${key}:0001`,
  order: 1,
  role: "button",
  accessibleName: key,
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
  ariaControls: target,
  ariaExpanded: expanded,
  disclosureIndependence: "source-bound-row-local",
});

const actionFor = (controlKey: string): Action => ({
  controlKey,
  operation: "click",
  safety: "read-only",
  transition: "open",
});

export const surfaceFor = (active: readonly string[]): RevealSurface =>
  revealSurfaceFor(
    ["a", "b", "c", "d"].map((key) =>
      controlFor(key, `panel-${key}`, active.includes(key)),
    ),
  );

const branchFor = (
  keys: readonly string[],
  surfaces: readonly RevealSurface[],
): RevealBranch => {
  const steps = keys.map((key, index) => {
    const before = surfaces[index];
    const after = surfaces[index + 1];
    if (before === undefined || after === undefined)
      throw new Error("fixture surface is missing");
    return revealStepFor(
      actionFor(key),
      before,
      after,
      "/admin",
      "/admin",
      unchanged,
    );
  });
  const surface = surfaces.at(-1);
  if (surface === undefined) throw new Error("fixture final surface missing");
  return {
    path: revealPathFor(steps, "/admin"),
    inventory: { controls: [], issues: [] } satisfies DomInventory,
    surface,
    url: "/admin",
  };
};

export const fixturesFor = (keys: readonly string[]) => {
  const root = surfaceFor([]);
  const single = (key: string): RevealBranch =>
    branchFor([key], [root, surfaceFor([key])]);
  const pair = (firstKey: string, secondKey: string): RevealBranch =>
    branchFor(
      [firstKey, secondKey],
      [root, surfaceFor([firstKey]), surfaceFor([firstKey, secondKey])],
    );
  const candidate = branchFor(keys, [
    root,
    ...keys.map((_, index) => surfaceFor(keys.slice(0, index + 1))),
  ]);
  const pairs = keys.flatMap((leftKey, firstIndex) =>
    keys
      .slice(firstIndex + 1)
      .flatMap((rightKey) => [
        pair(leftKey, rightKey),
        pair(rightKey, leftKey),
      ]),
  );
  return {
    candidate,
    singles: keys.map(single),
    pairs,
  };
};

export const fixtures = () => fixturesFor(["a", "b", "c"]);

export const untrustedSurfaceFor = (surface: RevealSurface): RevealSurface =>
  revealSurfaceFor(
    surface.controls.map((control) => ({
      ...control,
      disclosureIndependence: undefined,
    })),
  );

export const surfaceWithControlFor = (
  surface: RevealSurface,
  controlKey: string,
  patch: Partial<RevealSurface["controls"][number]>,
): RevealSurface =>
  revealSurfaceFor(
    surface.controls.map((control) =>
      control.controlKey === controlKey ? { ...control, ...patch } : control,
    ),
  );

export const branchWithoutPaths = (
  branches: readonly RevealBranch[],
  pathDigests: readonly string[],
): readonly RevealBranch[] =>
  branches.filter(({ path }) => !pathDigests.includes(path.digest));

export const contextFor = (): RevealReductionContext => ({
  campaignId: "campaign-e657",
  sourceSha: "a".repeat(SOURCE_SHA_LENGTH),
  sourceTree: "b".repeat(SOURCE_SHA_LENGTH),
  treeDigest: "c".repeat(DIGEST_LENGTH),
  sourceDigest: "d".repeat(DIGEST_LENGTH),
  planDigest: "e".repeat(DIGEST_LENGTH),
  selectorDigest: "f".repeat(DIGEST_LENGTH),
  stateId: "state-e657",
  stateDigest: "1".repeat(DIGEST_LENGTH),
  role: "admin",
  profile: "demo",
  routeKey: "admin:/admin",
  resolvedRoute: "/admin",
});

export const diagnosisFor = (
  context: RevealReductionContext,
  input: {
    readonly branch: RevealBranch;
    readonly knownBranches: readonly RevealBranch[];
    readonly expectedContext: RevealReductionContext;
  },
) =>
  pairReductionDiagnosisFor({
    ...input,
    context,
    currentControlCount: 0,
    plannedControlCount: 0,
    maxControlsPerSegment: 8192,
  });
