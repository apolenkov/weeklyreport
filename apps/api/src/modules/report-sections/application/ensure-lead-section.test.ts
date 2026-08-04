import { describe, expect, it, vi } from "vitest";

import { ensureLeadSection } from "./ensure-lead-section.js";

const REPORT_ID = "report-1";
const USER_ID = "lead-1";

type LeadSectionPrisma = Parameters<typeof ensureLeadSection>[0];

function makePrisma(opts: {
  existing?: { id: string } | null;
  raced?: { id: string } | null;
  createThrows?: unknown;
  createdId?: string;
  projects?: { id: string }[];
  activityAttachments?: { activityId: string }[];
}) {
  const sectionFindUnique = vi
    .fn()
    .mockResolvedValueOnce(opts.existing ?? null)
    // Second call is the post-conflict re-read.
    .mockResolvedValue(opts.raced ?? null);
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
  const client = {
    reportSection: { findUnique: sectionFindUnique, create: sectionCreate },
    project: { findMany: projectFindMany },
    projectStatus: { createMany: projectStatusCreateMany },
    projectActivityLead: { findMany: activityLeadFindMany },
    activityStatus: { createMany: activityStatusCreateMany },
    $transaction: transaction,
  } as unknown as LeadSectionPrisma;
  transaction.mockImplementation(
    (callback: (tx: LeadSectionPrisma) => Promise<unknown>) => callback(client),
  );

  return {
    client,
    transaction,
    sectionFindUnique,
    sectionCreate,
    projectStatusCreateMany,
    activityLeadFindMany,
    activityStatusCreateMany,
  };
}

const P2002_SECTION = {
  code: "P2002",
  meta: { target: "ReportSection_reportId_authorId_key" },
};

describe("ensureLeadSection", () => {
  it("returns the existing section without creating", async () => {
    const { client, sectionCreate } = makePrisma({
      existing: { id: "sec-old" },
    });

    const result = await ensureLeadSection(client, REPORT_ID, USER_ID);

    expect(result).toEqual({ sectionId: "sec-old" });
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

  it("concurrent same-lead login: create P2002 resolves to the winner's section, no throw", async () => {
    const { client, transaction, sectionFindUnique, projectStatusCreateMany } =
      makePrisma({
        createThrows: P2002_SECTION,
        raced: { id: "sec-winner" },
      });

    const result = await ensureLeadSection(client, REPORT_ID, USER_ID);

    expect(result).toEqual({ sectionId: "sec-winner" });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(sectionFindUnique).toHaveBeenCalledTimes(2);
    // The loser must not seed statuses — the winner already did.
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

  it("re-throws a non-unique-violation error from create", async () => {
    const other = { code: "P2003" };
    const { client } = makePrisma({ createThrows: other });

    await expect(ensureLeadSection(client, REPORT_ID, USER_ID)).rejects.toBe(
      other,
    );
  });
});
