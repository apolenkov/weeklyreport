import type { Page } from "@playwright/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MatrixExecutableCase } from "../../matrix/matrix-finalizer.ts";
import { revealTransitionFor } from "../../matrix/reveal-transition.ts";
import type { RuntimeMatrixSource } from "../../matrix/runtime-matrix.ts";
import { revealSurfaceFor } from "../../preflight/reveal-path.ts";
import { NO_ROUTE_CACHE_CONTRACT_POLICY } from "../../source/contracts.ts";
import type { PreparedRuntimeState } from "../../support/state-preparation.ts";
import type { DomControlObservation, DomInventory } from "../dom-inventory.ts";
import type { FrozenCaseLiveRuntime } from "../frozen-case-live-actions.ts";
import { captureAndFinalizeFrozenCase } from "./frozen-case-live-evidence.ts";

type CaptureInput = Readonly<{
  readonly onInventory?: (inventory: DomInventory) => void;
  readonly onActionTarget?: (
    target: DomInventory["controls"][number] | undefined,
  ) => void;
}>;
type PhaseCapture = Readonly<{
  readonly bundle: Readonly<{
    readonly before: readonly never[];
    readonly action: readonly never[];
    readonly after: readonly never[];
    readonly observations: readonly never[];
    readonly inapplicable: readonly never[];
  }>;
  readonly cursor: Readonly<{
    readonly consoleMessages: number;
    readonly pageErrors: number;
    readonly requestFailures: number;
    readonly responses: number;
  }>;
}>;
type FinalizationInput = Readonly<{
  readonly matrixCase: MatrixExecutableCase;
  readonly runtimeIssues: readonly string[];
}>;
const captureFrozenPhaseMock = vi.hoisted(() =>
  vi.fn<(input: CaptureInput) => Promise<PhaseCapture>>(),
);
const finalizeFrozenCaseEvidenceMock = vi.hoisted(() =>
  vi.fn<(input: FinalizationInput, evidence: unknown) => unknown>(),
);

vi.mock("../frozen-case-live-capture.ts", () => ({
  captureFrozenPhase: captureFrozenPhaseMock,
  initialNavigation: vi.fn(),
}));

vi.mock("../frozen-case-live-actions.ts", () => ({
  controlsForCase: vi.fn(() => []),
}));

vi.mock("../frozen-case-evidence.ts", () => ({
  finalizeFrozenCaseEvidence: finalizeFrozenCaseEvidenceMock.mockImplementation(
    (input: FinalizationInput) => {
      return {
        cell: {
          cellId: input.matrixCase.caseId,
          controls: [],
          verdict: input.runtimeIssues.length === 0 ? "pass" : "fail",
        },
        issues: input.runtimeIssues,
      };
    },
  ),
}));

vi.mock("./frozen-case-live-tail.ts", () => ({
  attachLateRuntimeEvents: vi.fn((input: { readonly bundle: unknown }) =>
    Promise.resolve(input.bundle),
  ),
}));

const control = (name: string, order: number): DomControlObservation => ({
  controlKey: `button:${name}:${order}`,
  domOrderKey: `${String(order).padStart(4, "0")}:button:${name}:${order}`,
  order,
  role: "button",
  accessibleName: name,
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
});
const inventory = (
  controls: readonly ReturnType<typeof control>[],
): DomInventory => ({ controls, issues: [] });
const beforeInventory = inventory([control("Open", 0)]);
const afterInventory = inventory([
  control("Open", 0),
  control("Dialog action", 1),
]);
const action = {
  controlKey: "button:Open:0",
  operation: "click" as const,
  safety: "read-only" as const,
  transition: "open" as const,
};
const beforeSurface = revealSurfaceFor(beforeInventory.controls);
const afterSurface = revealSurfaceFor(afterInventory.controls);
const transition = revealTransitionFor(
  action,
  beforeSurface,
  afterSurface,
  "/lead/report#closed",
  "/lead/report#open",
  {
    status: "unchanged",
    beforeDigest: "a".repeat(64),
    afterDigest: "a".repeat(64),
  },
);
const matrixCase = {
  caseId: "case-live-transition",
  stateId: "state-live-transition",
  sourceSha: "a".repeat(40),
  profile: "minimal",
  role: "lead",
  catalogRoute: "/lead/report",
  resolvedRoute: "/lead/report#closed",
  networkPolicy: NO_ROUTE_CACHE_CONTRACT_POLICY,
  state: {
    profileCapability: "editable-active-report",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "allowed",
    fault: "none",
    controlTransition: "open",
  },
  kind: "executable",
  controlKey: action.controlKey,
  preparation: {
    revealPathDigest: "b".repeat(64),
    expectedSurfaceDigest: beforeSurface.digest,
    expectedActionTransitionDigest: transition.digest,
  },
  execution: { kind: "control", action },
} satisfies MatrixExecutableCase;
const source = {
  matrix: { revealTransitions: [transition] },
  revealSurfacesByDigest: new Map([
    [beforeSurface.digest, beforeSurface],
    [afterSurface.digest, afterSurface],
  ]),
  revealTransitionsByDigest: new Map([[transition.digest, transition]]),
} as unknown as RuntimeMatrixSource;
const runtime = { archiveRoot: "/archive" } as FrozenCaseLiveRuntime;
const prepared = {
  plan: {
    surface: {
      productContent: "available",
      productActions: "exercise",
      productActionsReason: null,
      shell: "required",
    },
  },
} as PreparedRuntimeState;
const collector = {
  waitForIdle: vi.fn(() => Promise.resolve()),
  consumeSince: vi.fn(() => ({
    records: {
      consoleMessages: [],
      pageErrors: [],
      requestFailures: [],
      responses: [],
    },
  })),
  detach: vi.fn(),
};
const navigation = {
  responseStatus: 200,
  events: {
    startedAt: "2026-08-10T00:00:00.000Z",
    cursor: {
      consoleMessages: 0,
      pageErrors: 0,
      requestFailures: 0,
      responses: 0,
    },
    collector,
  },
};

const capturedPhase = (
  input: CaptureInput,
  inventoryValue: DomInventory,
): Promise<PhaseCapture> => {
  input.onInventory?.(inventoryValue);
  input.onActionTarget?.(undefined);
  return Promise.resolve({
    bundle: {
      before: [],
      action: [],
      after: [],
      observations: [],
      inapplicable: [],
    },
    cursor: {
      consoleMessages: 0,
      pageErrors: 0,
      requestFailures: 0,
      responses: 0,
    },
  });
};

const capture = async (actionInventory: DomInventory) => {
  [beforeInventory, actionInventory, afterInventory].forEach((inventoryValue) =>
    captureFrozenPhaseMock.mockImplementationOnce((input) =>
      capturedPhase(input, inventoryValue),
    ),
  );
  const pageUrl = vi
    .fn<() => string>()
    .mockReturnValueOnce("/lead/report#closed")
    .mockReturnValueOnce("/lead/report#open")
    .mockReturnValueOnce("/lead/report#open");
  return captureAndFinalizeFrozenCase(
    { url: pageUrl } as unknown as Page,
    source,
    matrixCase,
    runtime,
    prepared,
    { resolvedRoute: "/lead/report", landingRoute: "/lead/report" },
    navigation as never,
  );
};

describe("live frozen action transition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the exact post-action surface passing", async () => {
    expect((await capture(afterInventory)).verdict).toBe("pass");
    const finalized = finalizeFrozenCaseEvidenceMock.mock.calls.at(-1)?.[0];
    expect(finalized?.runtimeIssues).toEqual([]);
  });

  it("fails the owning cell on a newly revealed post-freeze control", async () => {
    const drifted = inventory([
      ...afterInventory.controls,
      control("Unexpected", 2),
    ]);
    expect((await capture(drifted)).verdict).toBe("fail");
    const finalized = finalizeFrozenCaseEvidenceMock.mock.calls.at(-1)?.[0];
    expect(finalized?.runtimeIssues.join("; ")).toMatch(/unknown controls/u);
  });
});
