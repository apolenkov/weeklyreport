import { describe, expect, it, vi } from "vitest";

import { ensureLeadSection } from "./ensure-lead-section.js";

const REPORT_ID = "report-1";
const USER_ID = "lead-1";
const PUBLISHER_ID = "99999999-9999-4999-8999-999999999999";
const OPEN_REPORT = {
  id: REPORT_ID,
  status: "draft",
  periodState: "open",
  periodStatus: "open",
  archived: false,
  autoPublished: false,
  autoArchived: false,
  publishedAt: null,
  publishedById: null,
  reopenedAt: null,
} as const;

type LeadSectionPrisma = Parameters<typeof ensureLeadSection>[0];

function makePrisma(opts: {
  existing?: { id: string } | null;
  report?: object | null;
  createThrows?: unknown;
  createdId?: string;
  projects?: { id: string }[];
  activityAttachments?: { activityId: string }[];
}) {
  const sectionFindUnique = vi.fn().mockResolvedValue(opts.existing ?? null);
  const sectionCreate = vi.fn().mockImplementation(() => {
    if (opts.createThrows) throw opts.createThrows;
    return { id: opts.createdId ?? "section-new" };
  });
  const projectFindMany = vi.fn().mockResolvedValue(opts.projects ?? []);
  const projectStatusCreateMany = vi.fn().mockResolvedValue({ count: 0 });
  const activityLeadFindMany = vi
    .fn()
    .mockResolvedValue(opts.activityAttachments ?? []);
  const activityStatusCreateMany = vi.fn().mockResolvedValue({ count: 0 });

  const transaction = vi.fn();
  const queryRaw = vi
    .fn()
    .mockResolvedValue(
      opts.report === null ? [] : [opts.report ?? OPEN_REPORT],
    );
  const executeRaw = vi.fn().mockResolvedValue(0);
  const client = {
    reportSection: { findUnique: sectionFindUnique, create: sectionCreate },
    project: { findMany: projectFindMany },
    projectStatus: { createMany: projectStatusCreateMany },
    projectActivityLead: { findMany: activityLeadFindMany },
    activityStatus: { createMany: activityStatusCreateMany },
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
    $transaction: transaction,
  } as unknown as LeadSectionPrisma;
  transaction.mockImplementation(
    (callback: (tx: LeadSectionPrisma) => Promise<unknown>) => callback(client),
  );

  return {
    client,
    transaction,
    queryRaw,
    executeRaw,
    sectionFindUnique,
    sectionCreate,
    projectStatusCreateMany,
    activityLeadFindMany,
    activityStatusCreateMany,
  };
}

describe("ensureLeadSection", () => {
  it("locks the parent before returning an existing section", async () => {
    const {
      client,
      transaction,
      queryRaw,
      executeRaw,
      sectionFindUnique,
      sectionCreate,
    } = makePrisma({
      existing: { id: "sec-old" },
    });

    const result = await ensureLeadSection(client, REPORT_ID, USER_ID);

    expect(result).toEqual({ sectionId: "sec-old" });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    const [lockSql, lockKey] = executeRaw.mock.calls[0] as [
      readonly string[],
      number,
    ];
    expect(lockSql[0]).toContain("SELECT pg_advisory_xact_lock");
    expect(lockKey).toBe(2_147_483_647);
    expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      sectionFindUnique.mock.invocationCallOrder[0] ?? 0,
    );
    expect(sectionCreate).not.toHaveBeenCalled();
  });

  it("rejects a stale existing section after its report was published", async () => {
    const { client, sectionFindUnique, sectionCreate } = makePrisma({
      existing: { id: "sec-old" },
      report: {
        ...OPEN_REPORT,
        status: "published",
        periodState: "published",
        periodStatus: "published",
        publishedAt: new Date("2026-08-31T10:00:00.000Z"),
        publishedById: PUBLISHER_ID,
      },
    });

    await expect(ensureLeadSection(client, REPORT_ID, USER_ID)).rejects.toThrow(
      "Cannot provision a section outside an editable report.",
    );
    expect(sectionFindUnique).not.toHaveBeenCalled();
    expect(sectionCreate).not.toHaveBeenCalled();
  });

  it("rejects new-section provisioning after its report was archived", async () => {
    const { client, sectionFindUnique, sectionCreate } = makePrisma({
      report: {
        ...OPEN_REPORT,
        status: "published",
        periodState: "archived",
        periodStatus: "published",
        archived: true,
        publishedAt: new Date("2026-08-31T10:00:00.000Z"),
        publishedById: PUBLISHER_ID,
      },
    });

    await expect(ensureLeadSection(client, REPORT_ID, USER_ID)).rejects.toThrow(
      "Cannot provision a section outside an editable report.",
    );
    expect(sectionFindUnique).not.toHaveBeenCalled();
    expect(sectionCreate).not.toHaveBeenCalled();
  });

  it("creates a fresh section and seeds unassessed project statuses", async () => {
    const { client, projectStatusCreateMany } = makePrisma({
      createdId: "sec-new",
      projects: [{ id: "p1" }, { id: "p2" }],
    });

    const result = await ensureLeadSection(client, REPORT_ID, USER_ID);

    expect(result).toEqual({ sectionId: "sec-new" });
    expect(projectStatusCreateMany).toHaveBeenCalledTimes(1);
    const arg = projectStatusCreateMany.mock.calls[0]?.[0] as {
      data: { reportSectionId: string; projectId: string; status: string }[];
      skipDuplicates: boolean;
    };
    expect(arg.data).toHaveLength(2);
    expect(arg.data[0]).toMatchObject({
      reportSectionId: "sec-new",
      projectId: "p1",
      status: null,
    });
    expect(arg.skipDuplicates).toBe(true);
  });

  it("seeds one unassessed ActivityStatus per attached activity", async () => {
    const { client, activityLeadFindMany, activityStatusCreateMany } =
      makePrisma({
        createdId: "sec-new",
        activityAttachments: [{ activityId: "act-1" }, { activityId: "act-2" }],
      });

    await ensureLeadSection(client, REPORT_ID, USER_ID);

    // Only non-archived activities the lead is attached to are considered.
    expect(activityLeadFindMany).toHaveBeenCalledWith({
      where: { leadId: USER_ID, activity: { archived: false } },
      select: { activityId: true },
    });
    expect(activityStatusCreateMany).toHaveBeenCalledTimes(1);
    const arg = activityStatusCreateMany.mock.calls[0]?.[0] as {
      data: { reportSectionId: string; activityId: string; status: string }[];
      skipDuplicates: boolean;
    };
    expect(arg.data).toEqual([
      { reportSectionId: "sec-new", activityId: "act-1", status: null },
      { reportSectionId: "sec-new", activityId: "act-2", status: null },
    ]);
    expect(arg.skipDuplicates).toBe(true);
  });

  it("does not seed activity statuses when the lead has no attachments", async () => {
    const { client, activityStatusCreateMany } = makePrisma({
      createdId: "sec-new",
      activityAttachments: [],
    });

    await ensureLeadSection(client, REPORT_ID, USER_ID);

    expect(activityStatusCreateMany).not.toHaveBeenCalled();
  });

  it("does not seed statuses when the lead has no active projects", async () => {
    const { client, projectStatusCreateMany } = makePrisma({
      createdId: "sec-new",
      projects: [],
    });

    await ensureLeadSection(client, REPORT_ID, USER_ID);

    expect(projectStatusCreateMany).not.toHaveBeenCalled();
  });

  it("rejects the whole transaction when activity-status seeding fails", async () => {
    const seedError = new Error("activity status seed failed");
    const { client, transaction, sectionCreate, activityStatusCreateMany } =
      makePrisma({
        createdId: "sec-new",
        activityAttachments: [{ activityId: "act-1" }],
      });
    activityStatusCreateMany.mockRejectedValueOnce(seedError);

    await expect(ensureLeadSection(client, REPORT_ID, USER_ID)).rejects.toBe(
      seedError,
    );

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(sectionCreate).toHaveBeenCalledTimes(1);
  });

  it("re-throws a create error and rolls back the transaction", async () => {
    const other = { code: "P2003" };
    const { client } = makePrisma({ createThrows: other });

    await expect(ensureLeadSection(client, REPORT_ID, USER_ID)).rejects.toBe(
      other,
    );
  });
});
