import type { Page, TestInfo } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import type { MatrixExecutableCase } from "../../../matrix/matrix-finalizer.ts";
import type { RuntimeMatrixSource } from "../../../matrix/runtime-matrix.ts";
import type { DOMControl } from "../../../source/contracts.ts";
import type { DomInventory } from "../../dom/dom-inventory.ts";
import {
  inventory,
  matrixCase,
} from "../../test-fixtures/frozen-case-live-runner.test-fixture.ts";
import {
  type FrozenCaseLiveRuntime,
  runFrozenCases,
} from "./frozen-case-live-runner.ts";

const isolatedMatrixCase = {
  ...matrixCase,
  execution: {
    kind: "control",
    action: {
      controlKey: "button:After:1",
      operation: "click",
      safety: "irreversible",
      transition: "none",
    },
  },
} satisfies MatrixExecutableCase;

const harness = vi.hoisted(() => ({
  inventories: [] as DomInventory[],
  capturedCaseIds: [] as string[],
  verdict: ((): "pass" | "fail" => "pass")(),
  reseed: vi.fn(),
  drain: vi.fn(() => Promise.resolve()),
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

vi.mock("../../../../helpers/e2e-runtime-state-setup.ts", () => ({
  reseedE2eRuntimeState: harness.reseed,
}));

vi.mock("../../../support/runtime-api-drain.ts", () => ({
  awaitRuntimeApiDrain: harness.drain,
}));

vi.mock("../../dom/dom-inventory.ts", () => ({
  RUNTIME_INTERACTION_EFFECTS: ["client-only", "mutation-required"],
  inventoryDom: vi.fn(() => {
    throw new Error("runner must not re-inventory after phase capture");
  }),
}));

vi.mock("../../evidence/frozen-case-evidence.ts", () => ({
  finalizeFrozenCaseEvidence: vi.fn(
    (input: {
      readonly matrixCase: MatrixExecutableCase;
      readonly controls: readonly DOMControl[];
    }) => {
      harness.capturedCaseIds.push(input.matrixCase.caseId);
      return {
        cell: {
          cellId: input.matrixCase.caseId,
          controls: input.controls,
          verdict: harness.verdict,
        },
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
    (input: {
      readonly onInventory?: (inventory: DomInventory) => void;
      readonly onActionTarget?: (
        target: DomInventory["controls"][number] | undefined,
      ) => void;
    }) => {
      const inventory = harness.inventories.shift();
      if (inventory === undefined)
        throw new Error("phase inventory fixture is exhausted");
      input.onInventory?.(inventory);
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
    },
  ),
  initialNavigation: vi.fn(() =>
    Promise.resolve({
      responseStatus: 200,
      events: {
        startedAt: "2026-08-07T00:00:00.000Z",
        cursor: {
          consoleMessages: 0,
          pageErrors: 0,
          requestFailures: 0,
          responses: 0,
        },
        collector: {
          waitForIdle: vi.fn(() => Promise.resolve()),
          consumeSince: vi.fn(() => ({
            records: {
              consoleMessages: [],
              pageErrors: [],
              requestFailures: [],
              responses: [],
            },
            cursor: {
              consoleMessages: 0,
              pageErrors: 0,
              requestFailures: 0,
              responses: 0,
            },
          })),
          detach: vi.fn(),
        },
      },
    }),
  ),
}));

vi.mock("../../../matrix/runtime-matrix.ts", () => ({
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

vi.mock("../../../matrix/runtime-matrix-evidence.ts", () => ({
  writeCell: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../../matrix/specialized/specialized-case-runner.ts", () => ({
  runSpecializedCase: vi.fn(() => Promise.resolve(undefined)),
}));

const resetHarness = (
  verdict: "pass" | "fail",
  inventories: readonly DomInventory[],
): void => {
  harness.reseed.mockClear();
  harness.drain.mockClear();
  harness.prepareCase.mockClear();
  harness.capturedCaseIds = [];
  harness.verdict = verdict;
  harness.inventories = [...inventories];
};

describe("frozen case live runner", () => {
  it("persists the action-phase inventory after a rerender", async () => {
    resetHarness("pass", [
      inventory("Before"),
      inventory("After"),
      inventory("After"),
    ]);

    const cells = await runFrozenCases(
      {
        context: () => ({ browser: () => ({}) }),
        goto: vi.fn(() => Promise.resolve(null)),
        url: () => "/lead/report",
      } as unknown as Page,
      {} as RuntimeMatrixSource,
      [isolatedMatrixCase],
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

  it("stops the lane immediately after a persisted non-pass cell", async () => {
    resetHarness("fail", [
      inventory("Before"),
      inventory("Action"),
      inventory("After"),
    ]);
    const second = {
      ...isolatedMatrixCase,
      caseId: "case-never-started",
      stateId: "state-never-started",
    } satisfies MatrixExecutableCase;

    await expect(
      runFrozenCases(
        {
          context: () => ({ browser: () => ({}) }),
          goto: vi.fn(() => Promise.resolve(null)),
          url: () => "/lead/report",
        } as unknown as Page,
        {} as RuntimeMatrixSource,
        [isolatedMatrixCase, second],
        {} as FrozenCaseLiveRuntime,
        {} as TestInfo,
      ),
    ).rejects.toThrow(/stopped the lane with verdict=fail/u);
    expect(harness.capturedCaseIds).toEqual([isolatedMatrixCase.caseId]);
  });
});
