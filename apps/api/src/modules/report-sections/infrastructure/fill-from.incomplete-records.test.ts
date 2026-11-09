import { describe, expect, it, vi } from "vitest";

import { SectionVersionConflictError } from "../application/report-sections.service.js";
import { LeadFormPrismaRepository } from "./lead-form.prisma-repository.js";

const OPEN_REPORT = {
  id: "44444444-4444-4444-8444-444444444444",
  periodState: "open",
  status: "draft",
  periodStatus: "open",
  archived: false,
  autoPublished: false,
  autoArchived: false,
  publishedAt: null,
  publishedById: null,
  reopenedAt: null,
};
const COMPLETE_SOURCE_RISK = {
  id: "source-risk",
  stableId: "source-risk-stable",
  projectId: "66666666-6666-4666-8666-666666666666",
  activityId: null,
  risk: "Vendor may slip",
  impact: "Delivery slips",
  mitigation: "Escalate",
  severity: "at-risk",
  stageNames: ["Development"],
};

interface StoredRows {
  readonly risks?: readonly object[];
  readonly decisions?: readonly object[];
  readonly updateCount?: number;
  readonly source?: {
    readonly risks: readonly object[];
    readonly decisions: readonly object[];
  };
}

function setup(stored: StoredRows) {
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const createMany = vi.fn((_rows: { data: Record<string, unknown>[] }) =>
    Promise.resolve({ count: 0 }),
  );
  const riskFindMany = vi.fn().mockResolvedValue(stored.risks ?? []);
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([OPEN_REPORT]),
    report: { findMany: vi.fn().mockResolvedValue([]) },
    publishedSearchDocument: { findMany: vi.fn().mockResolvedValue([]) },
    reportSection: {
      updateMany: vi.fn().mockResolvedValue({ count: stored.updateCount ?? 1 }),
    },
    item: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      deleteMany,
    },
    risk: { findMany: riskFindMany, deleteMany, createMany },
    decision: {
      findMany: vi.fn().mockResolvedValue(stored.decisions ?? []),
      deleteMany,
      createMany,
    },
    activityStatus: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const prisma = {
    reportSection: {
      findUnique: vi.fn().mockResolvedValue({
        items: [],
        ...(stored.source ?? { risks: [COMPLETE_SOURCE_RISK], decisions: [] }),
      }),
    },
    $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };
  const repo = new LeadFormPrismaRepository(prisma as never);
  return { createMany, deleteMany, repo, riskFindMany, tx };
}

describe("fillFromSection — stored incomplete target records", () => {
  it.each([
    [
      "risk",
      { risks: [{ stableId: "draft", impact: null, mitigation: "Escalate" }] },
    ],
    ["decision", { decisions: [{ stableId: "draft", impact: null }] }],
  ] as const)(
    "stops before clearing anything when the target holds an unfinished %s",
    async (_kind, stored) => {
      const { createMany, deleteMany, repo } = setup(stored);

      await expect(
        repo.fillFromSection("target", "source", 1),
      ).rejects.toMatchObject({ code: "INCOMPLETE_RECORD_OMITTED" });

      // No delete means the target's own rows, another author's rows and the
      // reviewer comments anchored to them are all still there.
      expect(deleteMany).not.toHaveBeenCalled();
      expect(createMany).not.toHaveBeenCalled();
    },
  );

  it("reports a stale version before it looks at the stored drafts", async () => {
    const { deleteMany, repo, riskFindMany } = setup({
      risks: [{ stableId: "draft", impact: null, mitigation: null }],
      updateCount: 0,
    });

    await expect(
      repo.fillFromSection("target", "source", 1),
    ).rejects.toBeInstanceOf(SectionVersionConflictError);

    expect(riskFindMany).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("erases an unfinished draft the author named for deletion", async () => {
    const { deleteMany, repo } = setup({
      risks: [{ stableId: "draft", impact: null, mitigation: null }],
    });

    await expect(
      repo.fillFromSection("target", "source", 1, [
        { kind: "risk", stableId: "draft" },
      ]),
    ).resolves.toBe(1);

    expect(deleteMany).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["a complete record", { kind: "risk", stableId: "done" }],
    ["an unknown identity", { kind: "risk", stableId: "missing" }],
    ["the other record kind", { kind: "decision", stableId: "draft" }],
  ] as const)("rejects a deletion intent naming %s", async (_name, intent) => {
    const { deleteMany, repo } = setup({
      risks: [
        { stableId: "draft", impact: null, mitigation: null },
        { stableId: "done", impact: "Slips", mitigation: "Escalate" },
      ],
    });

    await expect(
      repo.fillFromSection("target", "source", 1, [
        { kind: "risk", stableId: "draft" },
        intent,
      ]),
    ).rejects.toMatchObject({ code: "INCOMPLETE_RECORD_DELETION_INVALID" });

    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("replaces a target whose stored records are all complete", async () => {
    const { createMany, deleteMany, repo } = setup({
      risks: [{ stableId: "done", impact: "Slips", mitigation: "Escalate" }],
      decisions: [{ stableId: "decided", impact: "Scope moves" }],
    });

    await expect(repo.fillFromSection("target", "source", 1)).resolves.toBe(1);

    expect(deleteMany).toHaveBeenCalledTimes(3);
    expect(createMany).toHaveBeenCalledOnce();
  });

  it("copies only the source's complete records, as new records", async () => {
    const resolvedAt = new Date("2026-11-02T10:00:00.000Z");
    const decision = {
      id: "source-decision",
      stableId: "source-decision-stable",
      productId: COMPLETE_SOURCE_RISK.projectId,
      activityId: null,
      text: "Pick a vendor",
      owner: "Lead 1",
      deadline: null,
      impact: "Scope moves",
      resolvedAt,
      stageNames: ["Development"],
    };
    const source = {
      risks: [
        COMPLETE_SOURCE_RISK,
        { ...COMPLETE_SOURCE_RISK, id: "draft-risk", mitigation: null },
        // Complete, but its Activity is no longer attached to the target.
        { ...COMPLETE_SOURCE_RISK, projectId: null, activityId: "removed" },
      ],
      decisions: [decision, { ...decision, id: "draft", impact: null }],
    };
    const before = structuredClone(source);
    const { createMany, repo, tx } = setup({ source });

    await expect(repo.fillFromSection("target", "source", 1)).resolves.toBe(2);

    const created = createMany.mock.calls.flatMap(([rows]) => rows.data);
    expect(created).toMatchObject([
      { risk: "Vendor may slip", mitigation: "Escalate" },
      { text: "Pick a vendor", impact: "Scope moves", resolvedAt },
    ]);
    // No carried identity: the database mints a fresh stableId per copy.
    expect(created.some((row) => "stableId" in row || "id" in row)).toBe(false);
    expect(source).toEqual(before);
    expect(tx.reportSection.updateMany).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ where: { id: "target", version: 1 } }),
    );
  });
});
