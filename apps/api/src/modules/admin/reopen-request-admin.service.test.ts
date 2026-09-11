import type { ReopenRequestCursor, UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { customreportReopenRequestsTotal } from "../../infrastructure/metrics/metrics.registry.js";
import { createNullLogger } from "../../lib/logger.js";
import { unusedAdminRepositoryStubs } from "./__tests__/admin-repository-unused-stubs.js";
import { AdminPrometheusTelemetry } from "./admin-prometheus-telemetry.adapter.js";
import {
  AdminReopenRequestAlreadyProcessedError,
  type AdminRepository,
  type ReopenRequestRow,
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
  listReopenRequests: AdminRepository["listReopenRequests"] = () =>
    Promise.resolve([]),
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
    getSettings: unused,
    updateSettings: unused,
    saveReportingGroup: unused,
    archiveReportingGroup: unused,
    saveStageAssignment: unused,
    deleteStageAssignment: unused,
    listStageAssignments: unused,
    listReopenRequests,
    countPendingReopenRequests: () => Promise.resolve(0),
    decideReopenRequest: vi.fn().mockResolvedValue(decideResult),
  };
}

const TIED_CREATED_AT = new Date("2026-09-06T08:30:00.000Z");

function makeRow(sequence: number): ReopenRequestRow {
  const suffix = sequence.toString().padStart(12, "0");
  return {
    id: `11111111-1111-4111-8111-${suffix}`,
    reportSectionId: `22222222-2222-4222-8222-${suffix}`,
    reason: `Reason ${sequence}`,
    status: "approved",
    reviewNote: null,
    reviewedAt: null,
    createdAt: TIED_CREATED_AT,
    requestedBy: {
      id: `33333333-3333-4333-8333-${suffix}`,
      name: `Lead ${sequence}`,
      email: `lead-${sequence}@test.local`,
    },
    reviewedBy: null,
    sectionStatus: "submitted",
    report: {
      id: `44444444-4444-4444-8444-${suffix}`,
      weekLabel: "Weekly 36",
      periodStart: new Date("2026-08-31T00:00:00.000Z"),
      periodEnd: new Date("2026-09-06T23:59:59.999Z"),
    },
  };
}

function createKeysetList(
  rows: readonly ReopenRequestRow[],
): AdminRepository["listReopenRequests"] {
  const list: AdminRepository["listReopenRequests"] = (input) => {
    const cursor = input.cursor;
    const belowCursor = cursor
      ? rows.filter(
          (row) =>
            row.createdAt.getTime() < Date.parse(cursor.createdAt) ||
            (row.createdAt.getTime() === Date.parse(cursor.createdAt) &&
              row.id < cursor.id),
        )
      : rows;
    return Promise.resolve(belowCursor.slice(0, input.limit + 1));
  };
  return vi.fn(list);
}

async function counterValue(state: string): Promise<number> {
  const snapshot = await customreportReopenRequestsTotal.get();
  const match = snapshot.values.find((v) => String(v.labels.state) === state);
  return match?.value ?? 0;
}

describe("ReopenRequestAdminService.listReopenRequests", () => {
  it("reaches more than 100 same-timestamp rows exactly once across pages", async () => {
    const rows = Array.from({ length: 105 }, (_, index) =>
      makeRow(index + 1),
    ).toSorted((left, right) => right.id.localeCompare(left.id));
    const listReopenRequests = createKeysetList(rows);
    const service = new ReopenRequestAdminService(
      createRepository(
        { kind: "decided", decision: "approved" },
        listReopenRequests,
      ),
      logger,
      telemetry,
    );
    const loadedIds: string[] = [];
    let cursor: ReopenRequestCursor | undefined;

    do {
      const page = await service.listReopenRequests({
        status: "all",
        limit: 50,
        ...(cursor ? { cursor } : {}),
        session: headSession,
      });
      loadedIds.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    expect(loadedIds).toEqual(rows.map((row) => row.id));
    expect(new Set(loadedIds).size).toBe(105);
    expect(listReopenRequests).toHaveBeenCalledTimes(3);
  });

  it("builds the continuation from the last returned row, excluding the probe", async () => {
    const rows = [makeRow(3), makeRow(2), makeRow(1)];
    const service = new ReopenRequestAdminService(
      createRepository({ kind: "decided", decision: "approved" }, () =>
        Promise.resolve(rows),
      ),
      logger,
      telemetry,
    );

    const page = await service.listReopenRequests({
      status: "all",
      limit: 2,
      session: headSession,
    });

    expect(page.items.map((item) => item.id)).toEqual([
      rows[0]?.id,
      rows[1]?.id,
    ]);
    expect(page.nextCursor).toEqual({
      id: rows[1]?.id,
      createdAt: TIED_CREATED_AT.toISOString(),
    });
  });

  it("returns a null cursor when the exact page has no probe row", async () => {
    const rows = [makeRow(2), makeRow(1)];
    const service = new ReopenRequestAdminService(
      createRepository({ kind: "decided", decision: "approved" }, () =>
        Promise.resolve(rows),
      ),
      logger,
      telemetry,
    );

    await expect(
      service.listReopenRequests({
        status: "approved",
        limit: 2,
        session: headSession,
      }),
    ).resolves.toMatchObject({ nextCursor: null });
  });
});

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
