import { z } from "zod";

import type { GeometryElement, GeometrySnapshot } from "./evidence-types.ts";

const EXPECTED_VIEWPORT = { width: 1440, height: 900 } as const;
const MOVEMENT_TOLERANCE_PX = 2;
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

export type TransitionVisualEvaluation = Readonly<{
  outcome: "pass" | "fail";
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
  ...snapshot.issues.map((issue) => `${label} ${issue}`),
];

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

export function evaluateTransitionVisualPair(
  before: GeometrySnapshot,
  after: GeometrySnapshot,
  transition: string,
): TransitionVisualEvaluation {
  const beforeElements = uniqueLayoutElements(before);
  const afterElements = uniqueLayoutElements(after);
  const sharedKeys = [...beforeElements.keys()].filter((key) =>
    afterElements.has(key),
  );
  const missingKeys = [...beforeElements.keys()].filter(
    (key) => !afterElements.has(key),
  );
  const movements = sharedKeys.map((key) =>
    movementFor(
      elementFor(beforeElements, key),
      elementFor(afterElements, key),
      transition,
    ),
  );
  const issues = [
    ...viewportIssues("before", before),
    ...viewportIssues("after", after),
    ...loadingIssues(before, after),
    ...duplicateLayoutKeys(before).map(
      (key) => `before layout key ${key} is duplicated`,
    ),
    ...duplicateLayoutKeys(after).map(
      (key) => `after layout key ${key} is duplicated`,
    ),
    ...(sharedKeys.length === 0
      ? ["transition has no shared stable layout landmarks"]
      : []),
    ...missingKeys.map((key) => `stable layout key ${key} disappeared`),
    ...movements
      .filter(({ outcome }) => outcome === "fail")
      .map(
        ({ layoutKey, axes }) =>
          `stable layout key ${layoutKey} moved outside ${axes.join(",")} tolerance`,
      ),
  ];
  return {
    outcome: issues.length === 0 ? "pass" : "fail",
    issues,
    movements,
    reviewedMasks: VERTICAL_FLOW_TRANSITIONS.has(transition)
      ? ["declared vertical-flow transition masks y and height movement"]
      : [],
  };
}
