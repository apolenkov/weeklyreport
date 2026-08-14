import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { executeControlAction } from "../control-actions/control-actions.ts";

const harness = vi.hoisted(() => ({
  events: [] as string[],
  locator: {
    count: vi.fn(() => Promise.resolve(1)),
    isVisible: vi.fn(() => Promise.resolve(true)),
    isEnabled: vi.fn(() => Promise.resolve(true)),
  },
}));

vi.mock("../control-actions/control-action-executor.ts", () => ({
  executeControlAttempt: vi.fn(() => {
    harness.events.push("attempt");
    return Promise.resolve("pass");
  }),
}));

vi.mock("../control-target/rendered-control-target.ts", () => ({
  hrefTargetLocator: vi.fn(() => undefined),
  releaseRenderedNameTarget: vi.fn(() => Promise.resolve()),
  renderedNameTargetHandle: vi.fn(() => Promise.resolve(undefined)),
  targetLocator: vi.fn(() => harness.locator),
  titleTargetLocator: vi.fn(() => harness.locator),
}));

describe("control action recovery evidence boundary", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("brackets reset and baseline recovery after the action attempt", async () => {
    harness.events.length = 0;
    const execution = await executeControlAction({
      page: {} as never,
      control: {
        controlKey: "button:Submit:1",
        ariaRole: "button",
        accessibleName: "Submit",
        enabled: true,
      },
      action: {
        controlKey: "button:Submit:1",
        operation: "submit",
        safety: "irreversible",
        transition: "submit",
      },
      recovery: {
        databaseUrl: "postgresql://localhost/customreport_e2e",
        resetAndReseed: () => {
          harness.events.push("reset");
          return Promise.resolve();
        },
        assertBaseline: () => {
          harness.events.push("baseline");
          return Promise.resolve();
        },
      },
      recoveryBoundary: {
        beforeRecovery: () => {
          harness.events.push("before-recovery");
          return Promise.resolve();
        },
        afterRecovery: () => {
          harness.events.push("after-recovery");
          return Promise.resolve();
        },
      },
    });

    expect(execution).toMatchObject({ status: "pass", resetPerformed: true });
    expect(harness.events).toEqual([
      "attempt",
      "before-recovery",
      "reset",
      "baseline",
      "after-recovery",
    ]);
  });

  it("keeps a passing attempt separate from failed recovery", async () => {
    const afterRecovery = vi.fn(() => Promise.resolve());
    const execution = await executeControlAction({
      page: {} as never,
      control: {
        controlKey: "button:Submit:1",
        ariaRole: "button",
        accessibleName: "Submit",
        enabled: true,
      },
      action: {
        controlKey: "button:Submit:1",
        operation: "submit",
        safety: "irreversible",
        transition: "submit",
      },
      recovery: {
        databaseUrl: "postgresql://localhost/customreport_e2e",
        resetAndReseed: () => Promise.reject(new Error("reset failed")),
        assertBaseline: () => Promise.resolve(),
      },
      recoveryBoundary: {
        beforeRecovery: () => Promise.resolve(),
        afterRecovery,
      },
    });

    expect(execution).toMatchObject({ status: "pass", resetPerformed: false });
    expect(afterRecovery).toHaveBeenCalledWith({
      status: "fail",
      reason: "E2E reset/reseed or baseline oracle failed: reset failed",
    });
  });
});
