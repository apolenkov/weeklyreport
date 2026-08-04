import type { UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { customreportReopenRequestsTotal } from "../../infrastructure/metrics/metrics.registry.js";
import { createNullLogger } from "../../lib/logger.js";
import { AdminPrometheusTelemetry } from "./admin-prometheus-telemetry.adapter.js";
import { unusedAdminRepositoryStubs } from "./admin-repository-unused-stubs.js";
import {
  AdminReopenRequestAlreadyProcessedError,
  type AdminRepository,
} from "./admin-shared.js";
import { ReopenRequestAdminService } from "./reopen-request-admin.service.js";

const headSession: UserSession = {
  userId: "head-1",
  email: "head@test.local",
  name: "Head",
  role: "head",
  reportingGroupId: "group-1",
  viewerGroupAccess: ["group-1"],
  activeReportId: null,
  activeReportSectionId: null,
};
const logger = createNullLogger();
const telemetry = new AdminPrometheusTelemetry();

function createRepository(
  decideResult: Awaited<ReturnType<AdminRepository["decideReopenRequest"]>>,
): AdminRepository {
  const unused = (): never => {
    throw new Error("not exercised by reopen-request-admin tests");
  };
  return {
    ...unusedAdminRepositoryStubs(),
    getSnapshot: unused,
    saveSnapshot: unused,
    upsertUser: unused,
    removeUser: unused,
    upsertProject: unused,
    removeProject: unused,
    upsertReminderRule: unused,
    removeReminderRule: unused,
    getSettings: unused,
    updateSettings: unused,
    saveReportingGroup: unused,
    archiveReportingGroup: unused,
    saveStageAssignment: unused,
    deleteStageAssignment: unused,
    listStageAssignments: unused,
    listReopenRequests: () => Promise.resolve([]),
    countPendingReopenRequests: () => Promise.resolve(0),
    decideReopenRequest: vi.fn().mockResolvedValue(decideResult),
  };
}

async function counterValue(state: string): Promise<number> {
  const snapshot = await customreportReopenRequestsTotal.get();
  const match = snapshot.values.find((v) => String(v.labels.state) === state);
  return match?.value ?? 0;
}

describe("ReopenRequestAdminService.respondReopenRequest", () => {
  it("a winning decision increments the funnel metric AFTER the repository call", async () => {
    const before = await counterValue("approved");
    const service = new ReopenRequestAdminService(
      createRepository({ kind: "decided", decision: "approved" }),
      logger,
      telemetry,
    );

    const result = await service.respondReopenRequest({
      id: "req-1",
      decision: "approved",
      decidedBy: "head-1",
      session: headSession,
    });

    expect(result).toEqual({
      success: true,
      decision: "approved",
      staleAutoClosed: false,
    });
    expect(await counterValue("approved")).toBe(before + 1);
  });

  it("already-processed throws AdminReopenRequestAlreadyProcessedError and skews no metric", async () => {
    const before = await counterValue("approved");
    const service = new ReopenRequestAdminService(
      createRepository({ kind: "already-processed" }),
      logger,
      telemetry,
    );

    await expect(
      service.respondReopenRequest({
        id: "req-1",
        decision: "approved",
        decidedBy: "head-1",
        session: headSession,
      }),
    ).rejects.toBeInstanceOf(AdminReopenRequestAlreadyProcessedError);
    expect(await counterValue("approved")).toBe(before);
  });

  it("a stale auto-close reports rejected/staleAutoClosed and skews no metric", async () => {
    const before = await counterValue("approved");
    const service = new ReopenRequestAdminService(
      createRepository({ kind: "stale" }),
      logger,
      telemetry,
    );

    const result = await service.respondReopenRequest({
      id: "req-1",
      decision: "approved",
      decidedBy: "head-1",
      session: headSession,
    });

    expect(result).toEqual({
      success: true,
      decision: "rejected",
      staleAutoClosed: true,
    });
    expect(await counterValue("approved")).toBe(before);
  });

  it("trims a blank note to null before forwarding to the repository", async () => {
    const repo = createRepository({ kind: "decided", decision: "rejected" });
    const service = new ReopenRequestAdminService(repo, logger, telemetry);

    await service.respondReopenRequest({
      id: "req-1",
      decision: "rejected",
      note: " ".repeat(3),
      decidedBy: "head-1",
      session: headSession,
    });

    expect(repo.decideReopenRequest).toHaveBeenCalledWith(
      expect.objectContaining({ reviewNote: null }),
    );
  });
});
