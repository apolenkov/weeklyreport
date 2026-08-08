import { z } from "zod";

import type { GeometryElement, GeometrySnapshot } from "./evidence-types.ts";

const EXPECTED_VIEWPORT = { width: 1440, height: 900 } as const;
const MOVEMENT_TOLERANCE_PX = 2;
const ZERO_SIZE_ISSUE_PATTERN = /^element (?<index>\d+) has zero-size layout$/u;
const VERTICAL_FLOW_TRANSITIONS = new Set([
  "open",
  "submit",
  "publish",
  "delete",
  "revoke",
  "restore",
  "retry",
  "cancel",
]);
const geometryElementSchema = z
  .object({
    index: z.number().int().nonnegative(),
    tagName: z.string().min(1),
    role: z.string().nullable(),
    name: z.string(),
    layoutKey: z.string().min(1).nullable(),
    layoutStability: z.enum(["position-size", "position-width"]).nullable(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    layoutVisible: z.boolean(),
    visible: z.boolean(),
  })
  .strict();
const geometrySnapshotSchema = z
  .object({
    viewport: z.object({ width: z.number(), height: z.number() }).strict(),
    document: z
      .object({
        scrollWidth: z.number(),
        scrollHeight: z.number(),
      })
      .strict(),
    loading: z
      .object({
        busyCount: z.number().int().nonnegative(),
        skeletonCount: z.number().int().nonnegative(),
      })
      .strict(),
    elements: z.array(geometryElementSchema).readonly(),
    issues: z.array(z.string()).readonly(),
  })
  .strict();
type Axis = "x" | "y" | "width" | "height";
type Movement = Readonly<{
  layoutKey: string;
  axes: readonly Axis[];
  deltas: Readonly<Record<Axis, number>>;
  outcome: "pass" | "fail";
}>;
export type TransitionVisualPolicy = Readonly<{
  requireNoZeroSize: boolean;
  allowNoSharedStableLayoutLandmarks: boolean;
  allowCrossRouteStableLayoutChange: boolean;
}>;
const STRICT_TRANSITION_VISUAL_POLICY = {
  requireNoZeroSize: true,
  allowNoSharedStableLayoutLandmarks: false,
  allowCrossRouteStableLayoutChange: false,
} as const satisfies TransitionVisualPolicy;
export const FROZEN_LIVE_TRANSITION_VISUAL_POLICY = {
  requireNoZeroSize: false,
  allowNoSharedStableLayoutLandmarks: true,
  allowCrossRouteStableLayoutChange: false,
} as const satisfies TransitionVisualPolicy;
export type TransitionVisualEvaluation = Readonly<{
  outcome: "pass" | "fail";
  comparison: "same-route-landmarks" | "cross-route-snapshots";
  issues: readonly string[];
  movements: readonly Movement[];
  reviewedMasks: readonly string[];
}>;
export const parseGeometrySnapshot = (value: unknown): GeometrySnapshot =>
  geometrySnapshotSchema.parse(value);

const uniqueLayoutElements = (
  snapshot: GeometrySnapshot,
): ReadonlyMap<string, GeometryElement> =>
  new Map(
    snapshot.elements.flatMap((element) =>
      element.layoutKey === null ? [] : [[element.layoutKey, element] as const],
    ),
  );
const duplicateLayoutKeys = (snapshot: GeometrySnapshot): readonly string[] => {
  const keys = snapshot.elements.flatMap(({ layoutKey }) =>
    layoutKey === null ? [] : [layoutKey],
  );
  return keys.filter((key, index) => keys.indexOf(key) !== index);
};

const axesFor = (
  element: GeometryElement,
  transition: string,
): readonly Axis[] => {
  const declared =
    element.layoutStability === "position-size"
      ? (["x", "y", "width", "height"] as const)
      : (["x", "y", "width"] as const);
  return VERTICAL_FLOW_TRANSITIONS.has(transition)
    ? declared.filter((axis) => axis === "x" || axis === "width")
    : declared;
};

const movementFor = (
  before: GeometryElement,
  after: GeometryElement,
  transition: string,
): Movement => {
  const axes = axesFor(before, transition);
  const deltas = {
    x: after.x - before.x,
    y: after.y - before.y,
    width: after.width - before.width,
    height: after.height - before.height,
  };
  return {
    layoutKey: before.layoutKey ?? "missing-layout-key",
    axes,
    deltas,
    outcome: axes.some((axis) => Math.abs(deltas[axis]) > MOVEMENT_TOLERANCE_PX)
      ? "fail"
      : "pass",
  };
};

const viewportIssues = (
  label: string,
  snapshot: GeometrySnapshot,
  policy: TransitionVisualPolicy,
): readonly string[] => [
  ...(snapshot.viewport.width === EXPECTED_VIEWPORT.width &&
  snapshot.viewport.height === EXPECTED_VIEWPORT.height
    ? []
    : [
        `${label} viewport is ${snapshot.viewport.width}x${snapshot.viewport.height}, expected 1440x900`,
      ]),
  ...(snapshot.document.scrollWidth <= snapshot.viewport.width
    ? []
    : [
        `${label} horizontal overflow is ${snapshot.document.scrollWidth - snapshot.viewport.width}px`,
      ]),
  ...snapshot.issues
    .filter(
      (issue) =>
        policy.requireNoZeroSize || !isReviewedHiddenZeroSize(snapshot, issue),
    )
    .map((issue) => `${label} ${issue}`),
];

const isReviewedHiddenZeroSize = (
  snapshot: GeometrySnapshot,
  issue: string,
): boolean => {
  const indexText = ZERO_SIZE_ISSUE_PATTERN.exec(issue)?.groups?.index;
  if (indexText === undefined) return false;
  const matchingElements = snapshot.elements.filter(
    ({ index }) => index === Number(indexText),
  );
  const element = matchingElements[0];
  return (
    matchingElements.length === 1 &&
    element?.layoutKey === null &&
    !element.visible
  );
};

const loadingIssues = (
  before: GeometrySnapshot,
  after: GeometrySnapshot,
): readonly string[] => {
  const afterLoading = after.loading.busyCount + after.loading.skeletonCount;
  if (afterLoading === 0) return [];
  const beforeLoading = before.loading.busyCount + before.loading.skeletonCount;
  return [
    beforeLoading > 0
      ? `loading replacement is incomplete: ${after.loading.busyCount} busy region(s) and ${after.loading.skeletonCount} skeleton(s) remain`
      : `loading appeared after the settled transition: ${after.loading.busyCount} busy region(s) and ${after.loading.skeletonCount} skeleton(s)`,
  ];
};

const elementFor = (
  elements: ReadonlyMap<string, GeometryElement>,
  key: string,
): GeometryElement => {
  const element = elements.get(key);
  if (element === undefined)
    throw new Error(`Stable layout key ${key} was not indexed`);
  return element;
};

const stableLayoutIssues = (
  hasNoDeclaredLandmarks: boolean,
  missingKeys: readonly string[],
  addedKeys: readonly string[],
  movements: readonly Movement[],
  policy: TransitionVisualPolicy,
): readonly string[] => {
  if (policy.allowCrossRouteStableLayoutChange) return [];
  return [
    ...(hasNoDeclaredLandmarks && !policy.allowNoSharedStableLayoutLandmarks
      ? ["transition has no shared stable layout landmarks"]
      : []),
    ...missingKeys.map((key) => `stable layout key ${key} disappeared`),
    ...addedKeys.map((key) => `stable layout key ${key} appeared after`),
    ...movements
      .filter(({ outcome }) => outcome === "fail")
      .map(
        ({ layoutKey, axes }) =>
          `stable layout key ${layoutKey} moved outside ${axes.join(",")} tolerance`,
      ),
  ];
};

const reviewedMasksFor = (
  transition: string,
  hasNoDeclaredLandmarks: boolean,
  policy: TransitionVisualPolicy,
): readonly string[] => [
  ...(VERTICAL_FLOW_TRANSITIONS.has(transition)
    ? ["declared vertical-flow transition masks y and height movement"]
    : []),
  ...(policy.requireNoZeroSize
    ? []
    : ["transition policy masks unkeyed invisible zero-size geometry issues"]),
  ...(hasNoDeclaredLandmarks && policy.allowNoSharedStableLayoutLandmarks
    ? ["transition policy allows no shared stable layout landmarks"]
    : []),
  ...(policy.allowCrossRouteStableLayoutChange
    ? [
        "proven cross-route navigation masks stable landmark topology and movement comparison",
      ]
    : []),
];

export function evaluateTransitionVisualPair(
  before: GeometrySnapshot,
  after: GeometrySnapshot,
  transition: string,
  policy: TransitionVisualPolicy = STRICT_TRANSITION_VISUAL_POLICY,
): TransitionVisualEvaluation {
  const beforeElements = uniqueLayoutElements(before);
  const afterElements = uniqueLayoutElements(after);
  const sharedKeys = [...beforeElements.keys()].filter((key) =>
    afterElements.has(key),
  );
  const missingKeys = [...beforeElements.keys()].filter(
    (key) => !afterElements.has(key),
  );
  const addedKeys = [...afterElements.keys()].filter(
    (key) => !beforeElements.has(key),
  );
  const hasNoDeclaredLandmarks =
    beforeElements.size === 0 && afterElements.size === 0;
  const movements = sharedKeys.map((key) =>
    movementFor(
      elementFor(beforeElements, key),
      elementFor(afterElements, key),
      transition,
    ),
  );
  const issues = [
    ...viewportIssues("before", before, policy),
    ...viewportIssues("after", after, policy),
    ...loadingIssues(before, after),
    ...duplicateLayoutKeys(before).map(
      (key) => `before layout key ${key} is duplicated`,
    ),
    ...duplicateLayoutKeys(after).map(
      (key) => `after layout key ${key} is duplicated`,
    ),
    ...stableLayoutIssues(
      hasNoDeclaredLandmarks,
      missingKeys,
      addedKeys,
      movements,
      policy,
    ),
  ];
  return {
    outcome: issues.length === 0 ? "pass" : "fail",
    comparison: policy.allowCrossRouteStableLayoutChange
      ? "cross-route-snapshots"
      : "same-route-landmarks",
    issues,
    movements,
    reviewedMasks: reviewedMasksFor(transition, hasNoDeclaredLandmarks, policy),
  };
}
