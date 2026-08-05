import type { Page } from "@playwright/test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { runAction } from "./frozen-case-live-action-control.ts";
import type { FrozenCaseLiveRuntime } from "./frozen-case-live-preparation.ts";
import type { MatrixExecutableCase } from "./matrix-finalizer.ts";

const harness = vi.hoisted(() => ({
  reseed: vi.fn(() => undefined),
  execute: vi.fn(
    async (input: {
      readonly recovery?: {
        readonly resetAndReseed: () => Promise<void>;
        readonly assertBaseline: () => Promise<void>;
      };
    }) => {
      if (input.recovery === undefined) throw new Error("recovery missing");
      await input.recovery.resetAndReseed();
      await input.recovery.assertBaseline();
      return [
        {
          controlKey: "button:Publish:1",
          ariaRole: "button",
          accessibleName: "Publish",
          enabled: true,
          order: 1,
          status: "pass" as const,
          resetPerformed: true,
        },
      ];
    },
  ),
  prepareCase: vi.fn(
    (
      _source: unknown,
      _matrixCase: unknown,
      _runtime: unknown,
      _resetter?: () => void | Promise<void>,
    ) => Promise.resolve({ prepared: { plan: { surface: undefined } } }),
  ),
  inventory: {
    controls: [
      {
        controlKey: "button:Publish:1",
        domOrderKey: "0001:button:Publish:1",
        order: 1,
        role: "button",
        accessibleName: "Publish",
        enabled: true,
        disabled: false,
        visible: true,
        tagName: "button",
        inputType: null,
        href: null,
      },
    ],
    issues: [],
  },
}));

vi.mock("../helpers/e2e-database-setup.js", () => ({
  reseedE2eDatabase: harness.reseed,
}));
vi.mock("./dom-inventory.ts", () => ({
  inventoryDom: vi.fn(() => Promise.resolve(harness.inventory)),
}));
vi.mock("./frozen-case-live-preparation.ts", () => ({
  loginForCase: vi.fn(() => Promise.resolve()),
  prepareCase: harness.prepareCase,
  stateForCase: vi.fn(() => ({})),
}));
vi.mock("./live-control-lane.ts", () => ({
  executeLiveControlPlans: harness.execute,
}));
vi.mock("./runtime-matrix.ts", () => ({
  routeForState: vi.fn(() => ({ resolvedRoute: "/lead/report" })),
}));

const matrixCase = {
  caseId: "case-recovery",
  stateId: "state-recovery",
  sourceSha: "a".repeat(40),
  profile: "full",
  role: "head",
  catalogRoute: "/head/report/[reportId]",
  resolvedRoute: "/head/report/a0000000-0000-4000-8000-000000000001",
  state: {
    profileCapability: "publish-flow",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "allowed",
    fault: "none",
    controlTransition: "publish",
  },
  kind: "executable",
  execution: {
    kind: "control",
    action: {
      controlKey: "button:Publish:1",
      operation: "publish",
      safety: "irreversible",
      transition: "publish",
    },
  },
} as MatrixExecutableCase;

const runtime = {
  databaseUrl: "postgresql://localhost/customreport_e2e",
  repoRoot: "/workspace/customreport",
} as FrozenCaseLiveRuntime;

afterEach(() => {
  harness.reseed.mockClear();
  harness.execute.mockClear();
  harness.prepareCase.mockClear();
  vi.unstubAllEnvs();
});

describe("frozen stateful control recovery", () => {
  it("reseeds once and prepares the oracle without a second reseed", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/customreport_dev");
    const outcome = await runAction(
      { goto: vi.fn(() => Promise.resolve()) } as unknown as Page,
      {} as never,
      matrixCase,
      runtime,
    );

    expect(outcome?.status).toBe("pass");
    expect(harness.reseed).toHaveBeenCalledOnce();
    expect(harness.prepareCase).toHaveBeenCalledOnce();
    const resetter = harness.prepareCase.mock.calls[0]?.[3];
    expect(resetter).toEqual(expect.any(Function));
    if (typeof resetter === "function") await resetter();
    expect(harness.reseed).toHaveBeenCalledOnce();
  });
});
