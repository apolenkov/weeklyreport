import type { Page, TestInfo } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import type { EvidencePhase } from "../evidence/evidence-types.ts";
import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";
import type { RuntimeMatrixSource } from "../matrix/runtime-matrix.ts";
import type { DOMControl } from "../source/contracts.ts";
import type { DomInventory } from "./dom-inventory.ts";
import {
  type FrozenCaseLiveRuntime,
  runFrozenCases,
} from "./frozen-case-live-runner.ts";

const harness = vi.hoisted(() => ({
  inventories: [] as DomInventory[],
  reseed: vi.fn(),
  prepareCase: vi.fn(
    (
      _source: unknown,
      _matrixCase: unknown,
      _runtime: unknown,
      _resetter?: () => unknown,
    ) =>
      Promise.resolve({
        prepared: {
          plan: {
            surface: {
              productContent: "available",
              productActions: "exercise",
              productActionsReason: null,
              shell: "required",
            },
          },
        },
      }),
  ),
}));

vi.mock("../../helpers/e2e-runtime-state-setup.ts", () => ({
  reseedE2eRuntimeState: harness.reseed,
}));

vi.mock("./dom-inventory.ts", () => ({
  inventoryDom: vi.fn(() => {
    throw new Error("runner must not re-inventory after phase capture");
  }),
}));

vi.mock("./frozen-case-evidence.ts", () => ({
  captureFrozenCasePhases: vi.fn(
    async (input: {
      readonly capturePhase: (phase: EvidencePhase) => Promise<unknown>;
      readonly controls: (evidence: unknown) => readonly DOMControl[];
    }) => {
      await input.capturePhase("before");
      await input.capturePhase("action");
      await input.capturePhase("after");
      const controls = input.controls({
        action: {
          action: [{ kind: "control-action", artifactId: "action-artifact" }],
          observations: [{ observationId: "functional", outcome: "pass" }],
        },
      });
      const matrixCase = input as typeof input & {
        readonly matrixCase: MatrixExecutableCase;
      };
      return {
        cell: { cellId: matrixCase.matrixCase.caseId, controls },
        issues: [],
      };
    },
  ),
}));

vi.mock("./frozen-case-live-actions.ts", () => ({
  controlsForCase: vi.fn((inventory: DomInventory) => {
    return inventory.controls.map((control) => ({
      controlKey: control.controlKey,
      cellId: "case-rerender",
      ariaRole: control.role,
      accessibleName: control.accessibleName,
      enabled: control.enabled,
      order: control.order,
      actionResult: {
        kind: "not-exercised" as const,
        policy: "unavailable" as const,
        reason: "Rerender test control was not exercised",
      },
    }));
  }),
  loginForCase: vi.fn(() => Promise.resolve()),
  prepareCase: harness.prepareCase,
  stateForCase: vi.fn((matrixCase: MatrixExecutableCase) => ({
    profile: matrixCase.profile,
    axes: { route: `${matrixCase.role}:${matrixCase.catalogRoute}` },
  })),
}));

vi.mock("./frozen-case-live-capture.ts", () => ({
  captureFrozenPhase: vi.fn(
    (input: { readonly onInventory?: (inventory: DomInventory) => void }) => {
      const inventory = harness.inventories.shift();
      if (inventory === undefined)
        throw new Error("phase inventory fixture is exhausted");
      input.onInventory?.(inventory);
      return Promise.resolve({});
    },
  ),
  initialNavigation: vi.fn(() =>
    Promise.resolve({
      responseStatus: 200,
      events: {
        consoleMessages: [],
        pageErrors: [],
        requestFailures: [],
      },
    }),
  ),
}));

vi.mock("../matrix/runtime-matrix.ts", () => ({
  RUNTIME_MATRIX_ORACLE: {},
  routeForState: vi.fn(
    (_source: unknown, state: { axes: { route: string } }) =>
      state.axes.route.includes("published")
        ? { resolvedRoute: "/reports/published", target: "published" }
        : { resolvedRoute: "/lead/report", target: "active" },
  ),
  runtimeStateGroupKey: vi.fn(
    (profile: string, target: string) =>
      `${profile}:${target === "published" ? "published" : "active"}`,
  ),
}));

vi.mock("../matrix/runtime-matrix-evidence.ts", () => ({
  writeCell: vi.fn(() => Promise.resolve()),
}));

vi.mock("../matrix/specialized-case-runner.ts", () => ({
  runSpecializedCase: vi.fn(() => Promise.resolve(undefined)),
}));

const inventory = (accessibleName: string): DomInventory => ({
  controls: [
    {
      controlKey: `button:${accessibleName}:1`,
      domOrderKey: `0001:button:${accessibleName}:1`,
      order: 1,
      role: "button",
      accessibleName,
      enabled: true,
      disabled: false,
      visible: true,
      tagName: "button",
      inputType: null,
      href: null,
    },
  ],
  issues: [],
});

const matrixCase: MatrixExecutableCase = {
  caseId: "case-rerender",
  stateId: "state-rerender",
  sourceSha: "a".repeat(40),
  profile: "minimal",
  role: "lead",
  catalogRoute: "/lead/report",
  resolvedRoute: "/lead/report",
  state: {
    profileCapability: "editable-active-report",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "allowed",
    fault: "none",
    controlTransition: "none",
  },
  kind: "executable",
  execution: {
    kind: "control",
    action: {
      controlKey: "button:After:1",
      operation: "click",
      safety: "read-only",
      transition: "none",
    },
  },
};

describe("frozen case live runner", () => {
  it("persists the action-phase inventory after a rerender", async () => {
    harness.reseed.mockClear();
    harness.prepareCase.mockClear();
    harness.inventories = [
      inventory("Before"),
      inventory("After"),
      inventory("After"),
    ];

    const cells = await runFrozenCases(
      {
        context: () => ({ browser: () => ({}) }),
        goto: vi.fn(() => Promise.resolve(null)),
      } as unknown as Page,
      {} as RuntimeMatrixSource,
      [matrixCase],
      {} as FrozenCaseLiveRuntime,
      {} as TestInfo,
    );

    expect(
      cells[0]?.controls.map(({ accessibleName }) => accessibleName),
    ).toEqual(["After"]);
    const resetter = harness.prepareCase.mock.calls[0]?.[3];
    expect(resetter).toEqual(expect.any(Function));
    if (typeof resetter === "function") expect(resetter()).toBeUndefined();
    expect(harness.reseed).not.toHaveBeenCalled();
  });

  it("reseeds once between target groups and restores matrix order", async () => {
    harness.reseed.mockClear();
    harness.prepareCase.mockClear();
    harness.inventories = Array.from({ length: 9 }, (_, index) =>
      inventory(`Control ${index}`),
    );
    const published = {
      ...matrixCase,
      caseId: "case-published",
      stateId: "state-published",
      catalogRoute: "/reports/published",
      resolvedRoute: "/reports/published",
    } satisfies MatrixExecutableCase;
    const active = {
      ...matrixCase,
      caseId: "case-active",
      stateId: "state-active",
    } satisfies MatrixExecutableCase;
    const publishedSecond = {
      ...published,
      caseId: "case-published-second",
    } satisfies MatrixExecutableCase;

    const goto = vi.fn(() => Promise.resolve(null));
    const cells = await runFrozenCases(
      {
        context: () => ({ browser: () => ({}) }),
        goto,
      } as unknown as Page,
      {} as RuntimeMatrixSource,
      [published, active, publishedSecond],
      {
        archiveRoot: "/archive",
        baseURL: "http://127.0.0.1:3105",
        databaseUrl: "postgresql://runtime",
        repoRoot: "/repo",
      },
      {} as TestInfo,
    );

    expect(cells.map(({ cellId }) => cellId)).toEqual([
      "case-published",
      "case-active",
      "case-published-second",
    ]);
    expect(harness.reseed).toHaveBeenCalledOnce();
    expect(harness.reseed).toHaveBeenCalledWith({
      databaseUrl: "postgresql://runtime",
      profile: "minimal",
      repoRoot: "/repo",
    });
    expect(goto).toHaveBeenCalledOnce();
    expect(goto).toHaveBeenCalledWith("about:blank");
    expect(goto.mock.invocationCallOrder[0]).toBeLessThan(
      harness.reseed.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });
});
