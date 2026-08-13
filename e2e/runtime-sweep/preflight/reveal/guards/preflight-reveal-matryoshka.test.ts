import { describe, expect, it, vi } from "vitest";

import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
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

const ORIGIN = "http://127.0.0.1:3205";
const ROUTE = "/admin?tab=activities";
const DATABASE_DIGEST = "d".repeat(64);
const SIBLING_COUNT = 40;
const SIBLING_NAMES = Array.from({ length: SIBLING_COUNT }, (_, index) =>
  String(index).padStart(2, "0"),
);

type Stage = 0 | 1 | 2 | 3;
type ActionKind = "root" | "nested" | "detail";
const STAGE_TRANSITIONS: Readonly<
  Record<Stage, Readonly<Partial<Record<ActionKind, Stage>>>>
> = {
  0: { root: 1 },
  1: { root: 0, nested: 2 },
  2: { nested: 1, detail: 3 },
  3: { detail: 2 },
};

const state: CampaignMatrixState = {
  profile: "minimal",
  stateId: "activity-matryoshka-state",
  pairwiseDigest: "a".repeat(64),
  axes: {
    role: "admin",
    route: `admin:${ROUTE}`,
    profileCapability: "admin-examples",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "allowed",
    fault: "none",
    controlTransition: "none",
  },
};

const rootKeyFor = (name: string): string => `button:activity:${name}:root`;
const nestedKeyFor = (name: string): string => `button:activity:${name}:nested`;
const detailKeyFor = (name: string): string => `button:activity:${name}:detail`;

const controlKeyParts = (
  controlKey: string,
):
  | Readonly<{ readonly name: string; readonly kind: ActionKind }>
  | undefined => {
  const match = /^button:activity:(\d{2}):(root|nested|detail)$/u.exec(
    controlKey,
  );
  if (match === null) return undefined;
  const [, name, kind] = match;
  if (name === undefined || kind === undefined) return undefined;
  return { name, kind: kind as ActionKind };
};

const nextStageFor = (stage: Stage, kind: ActionKind): Stage => {
  const nextStage = STAGE_TRANSITIONS[stage][kind];
  if (nextStage === undefined)
    throw new Error(`Invalid activity transition from stage ${stage}: ${kind}`);
  return nextStage;
};

const initialStages = (): ReadonlyMap<string, Stage> =>
  new Map(SIBLING_NAMES.map((name) => [name, 0] as const));

const stagesWith = (name: string, stage: Stage): ReadonlyMap<string, Stage> =>
  new Map(
    SIBLING_NAMES.map(
      (candidate) => [candidate, candidate === name ? stage : 0] as const,
    ),
  );

const applyAction = (
  stages: ReadonlyMap<string, Stage>,
  controlKey: string,
): ReadonlyMap<string, Stage> => {
  const parts = controlKeyParts(controlKey);
  if (parts === undefined)
    throw new Error(`Unknown activity control: ${controlKey}`);
  const current = stages.get(parts.name) ?? 0;
  return new Map([
    ...stages.entries(),
    [parts.name, nextStageFor(current, parts.kind)] as const,
  ]);
};

const observationFor = (
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

type ControlDescriptor = Readonly<{
  readonly controlKey: string;
  readonly accessibleName: string;
}>;

const inventoryFor = (stages: ReadonlyMap<string, Stage>): DomInventory => {
  const descriptors: readonly ControlDescriptor[] = SIBLING_NAMES.flatMap(
    (name) => {
      const stage = stages.get(name) ?? 0;
      const root: ControlDescriptor = {
        controlKey: rootKeyFor(name),
        accessibleName: `${stage === 0 ? "Expand" : "Collapse"} activity ${name}`,
      };
      if (stage === 0) return [root];
      const nested: ControlDescriptor = {
        controlKey: nestedKeyFor(name),
        accessibleName: `${stage === 1 ? "Open" : "Close"} nested ${name}`,
      };
      if (stage === 1) return [root, nested];
      return [
        root,
        nested,
        {
          controlKey: detailKeyFor(name),
          accessibleName: `${stage === 2 ? "Open" : "Close"} detail ${name}`,
        },
      ];
    },
  );
  return {
    controls: descriptors.map(({ controlKey, accessibleName }, index) =>
      observationFor(controlKey, accessibleName, index + 1),
    ),
    issues: [],
  };
};

const actionsSincePrepare = (events: readonly string[]): readonly string[] => {
  const preparationStart = events.lastIndexOf("prepare");
  return events
    .slice(preparationStart + 1)
    .filter((event) => event.startsWith("execute:"))
    .map((event) => event.slice("execute:".length));
};

const currentStagesFor = (
  events: readonly string[],
): ReadonlyMap<string, Stage> =>
  actionsSincePrepare(events).reduce(
    (stages, controlKey) => applyAction(stages, controlKey),
    initialStages(),
  );

const activityHarnessFor = (): Readonly<{
  readonly events: () => readonly string[];
  readonly harness: RevealExecutionHarness;
}> => {
  const recordEvent = vi.fn<(event: string) => void>();
  const events = (): readonly string[] =>
    recordEvent.mock.calls.map(([event]) => event);
  const harness: RevealExecutionHarness = {
    prepare: () => {
      recordEvent("prepare");
      return Promise.resolve();
    },
    navigate: () => {
      recordEvent("navigate");
      return Promise.resolve();
    },
    currentUrl: () => new URL(ROUTE, ORIGIN).href,
    inventory: () => Promise.resolve(inventoryFor(currentStagesFor(events()))),
    executeReveal: ({ action }) => {
      const nextStages = applyAction(
        currentStagesFor(events()),
        action.controlKey,
      );
      recordEvent(`execute:${action.controlKey}`);
      return Promise.resolve({
        url: new URL(ROUTE, ORIGIN).href,
        inventory: inventoryFor(nextStages),
        nonMutation: {
          status: "unchanged" as const,
          beforeDigest: DATABASE_DIGEST,
          afterDigest: DATABASE_DIGEST,
        },
      });
    },
  };
  return { events, harness };
};

type DiscoveredControls = Awaited<ReturnType<typeof discoverRevealControls>>;

const controlKeysForSurface = (
  controls: DiscoveredControls,
  digest: string,
): readonly string[] =>
  controls
    .filter(({ expectedSurface }) => expectedSurface.digest === digest)
    .map(({ controlKey }) => controlKey)
    .toSorted();

const assertCanonicalSiblingPaths = (controls: DiscoveredControls): void => {
  const rootSurface = revealSurfaceFor(inventoryFor(initialStages()).controls);
  SIBLING_NAMES.forEach((name) => {
    const stageOne = revealSurfaceFor(
      inventoryFor(stagesWith(name, 1)).controls,
    );
    const stageTwo = revealSurfaceFor(
      inventoryFor(stagesWith(name, 2)).controls,
    );
    const stageThree = revealSurfaceFor(
      inventoryFor(stagesWith(name, 3)).controls,
    );
    expect(controlKeysForSurface(controls, rootSurface.digest)).toContain(
      rootKeyFor(name),
    );
    expect(controlKeysForSurface(controls, stageOne.digest)).toEqual(
      [rootKeyFor(name), nestedKeyFor(name)].toSorted(),
    );
    expect(controlKeysForSurface(controls, stageTwo.digest)).toEqual(
      [nestedKeyFor(name), detailKeyFor(name)].toSorted(),
    );
    expect(controlKeysForSurface(controls, stageThree.digest)).toEqual([
      detailKeyFor(name),
    ]);
    const nested = controls.find(
      ({ controlKey, expectedSurface }) =>
        controlKey === nestedKeyFor(name) &&
        expectedSurface.digest === stageOne.digest,
    );
    expect(
      nested?.revealPath.steps.map(({ controlKey }) => controlKey),
    ).toEqual([rootKeyFor(name)]);
    const detail = controls.find(
      ({ controlKey, expectedSurface }) =>
        controlKey === detailKeyFor(name) &&
        expectedSurface.digest === stageTwo.digest,
    );
    expect(
      detail?.revealPath.steps.map(({ controlKey }) => controlKey),
    ).toEqual([rootKeyFor(name), nestedKeyFor(name)]);
  });
};

describe("canonical matryoshka reveal traversal", () => {
  it("covers activity siblings and nested controls without sibling combinations", async () => {
    const fixture = activityHarnessFor();
    const controls = await discoverRevealControls({
      state,
      route: { resolvedRoute: ROUTE },
      initialInventory: inventoryFor(initialStages()),
      harness: fixture.harness,
      controlFor: preflightControlForPlan,
      maxDepth: 3,
      maxRevealMaterialEdges: 1024,
      maxRevealActions: 4096,
    });
    const executions = fixture
      .events()
      .filter((event) => event.startsWith("execute:"));

    expect(SIBLING_COUNT * (SIBLING_COUNT - 1)).toBeGreaterThan(1024);
    expect(executions).toHaveLength(SIBLING_COUNT * 15);
    expect(executions.length).toBeLessThan(1024);
    expect(controls).toHaveLength(SIBLING_COUNT * 6);
    expect(
      controls.every(({ expectedActionTransition }) =>
        Boolean(expectedActionTransition),
      ),
    ).toBe(true);
    assertCanonicalSiblingPaths(controls);
  });
});
