import { afterEach, describe, expect, it, vi } from "vitest";

import { PUBLISHED_REPORT_ID } from "../../../prisma/seeds/support/seed-constants.ts";
import type { RuntimeDatabaseSnapshot } from "./state-oracle.ts";
import {
  buildStatePreparationPlan,
  ImpossibleRuntimeStateError,
  prepareRuntimeState,
  type RuntimeStateAxes,
  type RuntimeStateDatabase,
  RuntimeStateTargetError,
  type RuntimeStateTransaction,
  type StatePreparationPlan,
  type StateTarget,
} from "./state-preparation.ts";

const axes: RuntimeStateAxes = {
  lifecycle: "open",
  submission: "draft",
  ownership: "single",
  permission: "allowed",
};
const request = {
  profile: "full" as const,
  axes,
  repoRoot: "/workspace/customreport",
  routeRole: "lead" as const,
  routeTarget: "active" as const,
  routeKey: "lead:/lead/report/[reportId]",
};
// prettier-ignore
const EXPECTED_DEMO_PUBLISHED_SECTION_ID = "a0000000-0000-4000-8000-000000000411";

function snapshotFor(plan: StatePreparationPlan): RuntimeDatabaseSnapshot {
  return {
    report: {
      status: plan.report.status,
      periodState: plan.report.periodState,
      periodStatus: plan.report.periodStatus,
      archived: plan.report.archived,
    },
    section: plan.section.state,
    ownership: {
      targetOwnerId: plan.targets.ownerId,
      owners: plan.ownership.assignments.map(({ userId }) => userId),
    },
    permission: {
      actorId: plan.permission.actorId,
      actorRole: "lead",
      authenticated: plan.permission.actorId !== null,
      allowed: plan.permission.boundary === "allowed",
      ownsTarget: plan.permission.actorId === plan.targets.ownerId,
    },
  };
}

function fakeDatabase(
  events: string[],
  snapshot: RuntimeDatabaseSnapshot,
  capturedTarget?: { value?: Pick<StateTarget, "reportId" | "sectionId"> },
): RuntimeStateDatabase {
  const transaction: RuntimeStateTransaction = {
    updateReport: () =>
      Promise.resolve().then(() => {
        events.push("report");
      }),
    updateSection: () =>
      Promise.resolve().then(() => {
        events.push("section");
      }),
    replaceOwnership: () =>
      Promise.resolve().then(() => {
        events.push("ownership");
      }),
    readSnapshot: (targets) =>
      Promise.resolve().then(() => {
        events.push("read");
        if (capturedTarget) {
          capturedTarget.value = {
            reportId: targets.reportId,
            sectionId: targets.sectionId,
          };
        }
        return snapshot;
      }),
  };
  return {
    transaction: async (work) => {
      events.push("transaction");
      return work(transaction);
    },
  };
}

afterEach(() => vi.unstubAllEnvs());
describe("runtime state preparation policy", () => {
  it("maps an allowed boundary to the canonical actor for each route role", () => {
    // prettier-ignore
    const actors = [["lead", "a0000000-0000-4000-8000-000000000011"], ["head", "a0000000-0000-4000-8000-000000000099"], ["admin", "a0000000-0000-4000-8000-000000000097"], ["viewer", "a0000000-0000-4000-8000-000000000098"]] as const;

    // prettier-ignore
    for (const [routeRole, actorId] of actors) {
      expect(buildStatePreparationPlan({ ...request, routeRole }).permission.actorId).toBe(actorId);
    }
  });

  it("rejects a published target for the minimal profile", () => {
    expect(() =>
      buildStatePreparationPlan({
        ...request,
        profile: "minimal",
        routeTarget: "published",
      }),
    ).toThrow(
      expect.objectContaining({
        reason: "profile-missing-capability",
      }),
    );
  });

  it("builds the same reset/reseed command plan for the same axes", () => {
    const first = buildStatePreparationPlan(request);
    const second = buildStatePreparationPlan(request);

    expect(second).toEqual(first);
    // prettier-ignore
    expect(first.resetCommands).toEqual([{ executable: process.execPath, args: ["--import", "tsx", "/workspace/customreport/prisma/seeds/profiles/seed-profile.ts", "full"] }]);
    expect(first.digest).toHaveLength(64);
  });
});
describe("runtime state preparation rejection", () => {
  it("rejects a state when stable seed rows cannot supply it", () => {
    expect(() =>
      buildStatePreparationPlan({
        ...request,
        profile: "minimal",
        axes: { ...axes, ownership: "multiple" },
      }),
    ).toThrow(ImpossibleRuntimeStateError);
    try {
      buildStatePreparationPlan({
        ...request,
        profile: "minimal",
        axes: { ...axes, ownership: "multiple" },
      });
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ImpossibleRuntimeStateError);
      if (error instanceof ImpossibleRuntimeStateError) {
        expect(error.reason).toBe("profile-missing-capability");
      }
    }
  });

  it("rejects owner permission without an assigned stage", () => {
    expect(() =>
      buildStatePreparationPlan({
        ...request,
        axes: { ...axes, ownership: "none", permission: "owner" },
      }),
    ).toThrow(expect.objectContaining({ reason: "owner-without-assignment" }));
  });
});

describe("runtime state preparation mutations", () => {
  it("keeps all period states in one mutation and builds a section/ownership oracle", () => {
    const plan = buildStatePreparationPlan({
      ...request,
      axes: {
        lifecycle: "reopened",
        submission: "approved",
        ownership: "multiple",
        permission: "owner",
      },
    });

    expect(plan.report).toMatchObject({
      status: "published",
      periodState: "open",
      periodStatus: "reopened",
      archived: false,
    });
    expect(plan.section.state).toEqual({
      status: "submitted",
      submittedAt: "present",
      verdict: "approved",
    });
    expect(plan.ownership.assignments).toHaveLength(2);
    expect(plan.ownership.assignments[1]?.userId).not.toBe(
      plan.targets.ownerId,
    );
  });

  it("carries denied lead-form surface semantics without changing ownership targets", () => {
    const plan = buildStatePreparationPlan({
      ...request,
      axes: { ...axes, permission: "non-owner" },
    });

    expect(plan.targets.ownerId).not.toBe(plan.permission.actorId);
    expect(plan.surface).toMatchObject({
      productContent: "denied",
      productActions: "inapplicable",
      shell: "required",
    });
  });

  it("resets and reseeds before mutating state inside one transaction", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/customreport_dev");
    vi.stubEnv("NODE_ENV", "test");
    const plan = buildStatePreparationPlan(request);
    const events: string[] = [];
    const result = await prepareRuntimeState(
      { ...request, databaseUrl: "postgresql://localhost/customreport_e2e" },
      fakeDatabase(events, snapshotFor(plan)),
      () =>
        Promise.resolve().then(() => {
          events.push("reset-and-seed");
        }),
    );

    expect(events).toEqual([
      "reset-and-seed",
      "transaction",
      "report",
      "section",
      "ownership",
      "read",
    ]);
    expect(result.observation.matches).toBe(true);
  });

  it("fails closed when profile reseeding fails before the transaction", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/customreport_dev");
    vi.stubEnv("NODE_ENV", "test");
    const events: string[] = [];
    const database = fakeDatabase(
      events,
      snapshotFor(buildStatePreparationPlan(request)),
    );
    const reseed = vi.fn(() =>
      Promise.reject(new Error("profile reseed failed")),
    );

    await expect(
      prepareRuntimeState(
        { ...request, databaseUrl: "postgresql://localhost/customreport_e2e" },
        database,
        reseed,
      ),
    ).rejects.toThrow("profile reseed failed");
    expect(reseed).toHaveBeenCalledOnce();
    expect(events).toEqual([]);
  });
});

describe("runtime state preparation adapters", () => {
  it("passes the selected report and section IDs into the database adapter", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/customreport_dev");
    vi.stubEnv("NODE_ENV", "test");
    const plan = buildStatePreparationPlan({
      ...request,
      profile: "demo",
      routeTarget: "published",
    });
    // prettier-ignore
    const capturedTarget: { value?: Pick<StateTarget, "reportId" | "sectionId"> } = {};

    await prepareRuntimeState(
      {
        ...request,
        profile: "demo",
        routeTarget: "published",
        databaseUrl: "postgresql://localhost/customreport_e2e",
      },
      fakeDatabase([], snapshotFor(plan), capturedTarget),
      () => Promise.resolve(),
    );

    // prettier-ignore
    expect(capturedTarget.value).toEqual({ reportId: PUBLISHED_REPORT_ID, sectionId: EXPECTED_DEMO_PUBLISHED_SECTION_ID });
  });

  it("rejects a developer database before invoking reset or the database", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/customreport_dev");
    const reset = vi.fn();
    const database = fakeDatabase(
      [],
      snapshotFor(buildStatePreparationPlan(request)),
    );

    await expect(
      prepareRuntimeState(
        { ...request, databaseUrl: "postgresql://localhost/customreport_dev" },
        database,
        reset,
      ),
    ).rejects.toBeInstanceOf(RuntimeStateTargetError);
    expect(reset).not.toHaveBeenCalled();
  });
});
