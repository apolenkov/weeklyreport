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
import type {
  RevealBranch,
  RevealDiscoveryState,
  RevealPureQueueInput,
} from "./preflight-reveal-branches.ts";
import { enqueueChangedBranch } from "./preflight-reveal-branches.ts";

const TRUSTED_TOGGLES = ["a", "b", "c", "d"] as const;
const DIGEST_LENGTH = 64;
type Occurrence = "0" | "1" | "2";
export type TrustedToggle = (typeof TRUSTED_TOGGLES)[number];

const unchanged = {
  status: "unchanged" as const,
  beforeDigest: "d".repeat(DIGEST_LENGTH),
  afterDigest: "d".repeat(DIGEST_LENGTH),
};

const controlFor = (
  key: TrustedToggle,
  expanded: boolean,
  cOccurrence: Occurrence,
): DomControlObservation => ({
  controlKey: `button:${key}:${key === "c" ? cOccurrence : "0"}`,
  domOrderKey: `000${String(TRUSTED_TOGGLES.indexOf(key) + 1)}:button:${key}:${key === "c" ? cOccurrence : "0"}`,
  order: TRUSTED_TOGGLES.indexOf(key) + 1,
  role: "button",
  accessibleName: `Toggle ${key}`,
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
  ariaControls: `panel-${key}`,
  ariaExpanded: expanded,
  disclosureIndependence: "source-bound-row-local",
});

const inventoryFor = (
  expanded: ReadonlySet<TrustedToggle>,
  cOccurrence: Occurrence = "0",
): DomInventory => ({
  controls: TRUSTED_TOGGLES.map((key) =>
    controlFor(key, expanded.has(key), cOccurrence),
  ),
  issues: [],
});

export const trustedSurfaceFor = (
  expanded: ReadonlySet<TrustedToggle>,
  cOccurrence: Occurrence = "0",
): RevealSurface =>
  revealSurfaceFor(inventoryFor(expanded, cOccurrence).controls);

export const controlKeyForTarget = (
  branch: RevealBranch,
  target: string,
): string => {
  const control = branch.surface.controls.find(
    ({ ariaControls }) => ariaControls === target,
  );
  if (control === undefined) throw new Error(`Missing control for ${target}`);
  return control.controlKey;
};

const actionFor = (
  key: TrustedToggle,
  cOccurrence: Occurrence = "0",
): Action => ({
  controlKey: `button:${key}:${key === "c" ? cOccurrence : "0"}`,
  operation: "click",
  safety: "read-only",
  transition: "open",
});

const branchFor = (
  keys: readonly TrustedToggle[],
  states: readonly ReadonlySet<TrustedToggle>[],
  cOccurrence: Occurrence = "0",
  branchUrl = "/admin",
): RevealBranch => {
  const surfaces = states.map((state) => trustedSurfaceFor(state, cOccurrence));
  const inventories = states.map((state) => inventoryFor(state, cOccurrence));
  const steps = keys.map((key, index) => {
    const before = surfaces[index];
    const after = surfaces[index + 1];
    if (before === undefined || after === undefined)
      throw new Error("Trusted fixture surface is missing");
    return revealStepFor(
      actionFor(key, cOccurrence),
      before,
      after,
      branchUrl,
      branchUrl,
      unchanged,
    );
  });
  const finalSurface = surfaces.at(-1);
  const finalInventory = inventories.at(-1);
  if (finalSurface === undefined || finalInventory === undefined)
    throw new Error("Trusted fixture final state is missing");
  return {
    path: revealPathFor(steps, branchUrl),
    inventory: finalInventory,
    surface: finalSurface,
    url: branchUrl,
  };
};

export type CanonicalFixture = Readonly<{
  readonly current: RevealBranch;
  readonly candidate: RevealBranch;
  readonly representative: RevealBranch;
  readonly known: readonly RevealBranch[];
}>;

export const trustedKnownBranchesFor = (): CanonicalFixture => {
  const root = new Set<TrustedToggle>();
  const stateFor = (...keys: readonly TrustedToggle[]) =>
    new Set<TrustedToggle>(keys);
  const single = (key: TrustedToggle) =>
    branchFor([key], [root, stateFor(key)]);
  const pair = (first: TrustedToggle, second: TrustedToggle) =>
    branchFor(
      [first, second],
      [
        root,
        stateFor(first),
        first === "c" || second === "c"
          ? stateFor(first, second, "d")
          : stateFor(first, second),
      ],
    );
  const representative = branchFor(["c"], [root, stateFor("c", "d")], "2");
  return {
    current: pair("a", "b"),
    candidate: branchFor(
      ["a", "b", "c"],
      [root, stateFor("a"), stateFor("a", "b"), stateFor("a", "b", "c", "d")],
      "1",
    ),
    representative,
    known: [
      single("a"),
      single("b"),
      pair("a", "b"),
      pair("b", "a"),
      pair("a", "c"),
      pair("c", "a"),
      pair("b", "c"),
      pair("c", "b"),
    ],
  };
};

export const discoveryStateFor = (
  current: RevealBranch,
  known: readonly RevealBranch[],
): RevealDiscoveryState => ({
  queue: known,
  controls: [],
  discovered: new Map(),
  visitedStatePaths: new Map(),
  actionCount: 0,
  branchCount: 0,
  currentBranch: current,
});

export const retainedStateFor = (
  fixture: CanonicalFixture,
  queueInput: RevealPureQueueInput,
): RevealDiscoveryState => {
  return enqueueChangedBranch({
    queueInput,
    state: discoveryStateFor(fixture.current, fixture.known),
    current: fixture.current,
    branch: fixture.representative,
    action: actionFor("c"),
  });
};
