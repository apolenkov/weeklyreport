import type { PrismaReportSectionWithRelations } from "@weeklyreport/report-persistence";
import { mapPrismaToAuthorReportSection } from "@weeklyreport/report-persistence";
import type { IncompleteRecordDeletion } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { SectionVersionConflictError } from "../application/report-sections.service";
import type { FabricatedRow } from "./__tests__/report-sections-prisma-harness";
import {
  baseRow,
  fullDecision,
  fullRisk,
  OWNED_PROJECT,
} from "./__tests__/report-sections-prisma-harness";
import {
  makeSaveTx,
  OPEN_LIFECYCLE_ROW,
  type StoredDetailRow,
} from "./__tests__/save-section-tx";
import { ReportSectionsPrismaRepository } from "./report-sections.prisma-repository";

const RISK_ID = "77777777-7777-4777-8777-777777777777";
const DECISION_ID = "99999999-9999-4999-8999-999999999999";
const UNKNOWN_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const OMITTED = { code: "INCOMPLETE_RECORD_OMITTED" };
const INVALID = { code: "INCOMPLETE_RECORD_DELETION_INVALID" };
const PARENT = {
  projectId: OWNED_PROJECT,
  project: { name: "Owned Project" },
  stageNames: ["Development"],
};

const riskRow = (details: {
  impact: string | null;
  mitigation: string | null;
}) => ({ ...fullRisk(PARENT), ...details });
const decisionRow = (impact: string | null) => ({
  ...fullDecision({ ...PARENT, productId: OWNED_PROJECT }),
  projectId: undefined,
  impact,
});

const DRAFT_RISK = riskRow({ impact: null, mitigation: null });
const COMPLETE_RISK = riskRow({ impact: "Slips", mitigation: "Escalate" });
const DRAFT_DECISION = decisionRow(null);

const sectionOf = (records: Partial<FabricatedRow>) =>
  mapPrismaToAuthorReportSection(
    baseRow(records) as unknown as PrismaReportSectionWithRelations,
  );

const deletion = (
  kind: IncompleteRecordDeletion["kind"],
  stableId: string,
): IncompleteRecordDeletion => ({ kind, stableId });

function setup(
  stored: {
    readonly risks?: readonly StoredDetailRow[];
    readonly decisions?: readonly StoredDetailRow[];
  },
  updateCount = 1,
) {
  const tx = makeSaveTx(updateCount, baseRow({ version: 2 }));
  tx.risk.findMany.mockResolvedValue([...(stored.risks ?? [])]);
  tx.decision.findMany.mockResolvedValue([...(stored.decisions ?? [])]);
  const prisma = {
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const repo = new ReportSectionsPrismaRepository(
    prisma as unknown as PrismaService,
  );
  return { repo, tx };
}

const firstCall = (mock: { mock: { invocationCallOrder: number[] } }) =>
  mock.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY;

describe("saveSection — stored incomplete records", () => {
  it("rejects a replacement that omits a stored incomplete risk before clearing anything", async () => {
    const { repo, tx } = setup({ risks: [DRAFT_RISK] });

    await expect(repo.saveSection(sectionOf({}), 1)).rejects.toMatchObject(
      OMITTED,
    );
    expect(firstCall(tx.reportSection.updateMany)).toBeLessThan(
      firstCall(tx.risk.findMany),
    );
    expect(tx.risk.deleteMany).not.toHaveBeenCalled();
    expect(tx.recordComment.findMany).not.toHaveBeenCalled();
    expect(tx.reportSection.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a replacement that omits a stored incomplete decision", async () => {
    const { repo } = setup({ decisions: [DRAFT_DECISION] });

    await expect(repo.saveSection(sectionOf({}), 1)).rejects.toMatchObject(
      OMITTED,
    );
  });

  it("reports a stale version before it inspects the stored drafts", async () => {
    const { repo, tx } = setup({ risks: [DRAFT_RISK] }, 0);

    await expect(repo.saveSection(sectionOf({}), 1)).rejects.toBeInstanceOf(
      SectionVersionConflictError,
    );
    expect(tx.risk.findMany).not.toHaveBeenCalled();
    expect(tx.risk.deleteMany).not.toHaveBeenCalled();
  });

  it("removes an incomplete record named by a deletion intent", async () => {
    const { repo, tx } = setup({
      risks: [DRAFT_RISK],
      decisions: [DRAFT_DECISION],
    });

    await expect(
      repo.saveSection(sectionOf({}), 1, [
        deletion("risk", RISK_ID),
        deletion("decision", DECISION_ID),
      ]),
    ).resolves.toMatchObject({ version: 2 });
    expect(tx.risk.deleteMany).toHaveBeenCalled();
  });

  it("keeps an incomplete record with its null details", async () => {
    const { repo, tx } = setup({ risks: [DRAFT_RISK] });

    await repo.saveSection(sectionOf({ risks: [DRAFT_RISK] }), 1);

    expect(tx.risk.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          stableId: RISK_ID,
          impact: null,
          mitigation: null,
        }),
      ],
    });
  });

  it("accepts a replacement that completes the stored draft under its identity", async () => {
    const { repo, tx } = setup({ risks: [DRAFT_RISK] });

    await repo.saveSection(sectionOf({ risks: [COMPLETE_RISK] }), 1);

    expect(tx.risk.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          stableId: RISK_ID,
          impact: "Slips",
          mitigation: "Escalate",
        }),
      ],
    });
  });

  it.each([
    {
      name: "a record the replacement also keeps",
      stored: { risks: [DRAFT_RISK] },
      kept: { risks: [DRAFT_RISK] },
      intents: [deletion("risk", RISK_ID)],
    },
    {
      name: "an identity this section does not store",
      stored: { risks: [DRAFT_RISK] },
      kept: { risks: [DRAFT_RISK] },
      intents: [deletion("risk", UNKNOWN_ID)],
    },
    {
      name: "a stored identity of the other kind",
      stored: { risks: [DRAFT_RISK] },
      kept: {},
      intents: [deletion("decision", RISK_ID)],
    },
    {
      name: "a stored complete record",
      stored: { risks: [COMPLETE_RISK] },
      kept: {},
      intents: [deletion("risk", RISK_ID)],
    },
  ])("rejects a deletion intent naming $name", async (scenario) => {
    const { repo, tx } = setup(scenario.stored);

    await expect(
      repo.saveSection(sectionOf(scenario.kept), 1, scenario.intents),
    ).rejects.toMatchObject(INVALID);
    expect(tx.risk.deleteMany).not.toHaveBeenCalled();
    expect(tx.decision.deleteMany).not.toHaveBeenCalled();
  });

  it("denies deleting published lineage before the version is touched", async () => {
    const tx = makeSaveTx(1, baseRow({ version: 2 }), [
      {
        ...OPEN_LIFECYCLE_ROW,
        status: "published",
        periodStatus: "reopened",
        publishedAt: new Date("2026-09-04T18:00:00.000Z"),
        reopenedAt: new Date("2026-09-04T19:00:00.000Z"),
      },
    ]);
    tx.decision.findMany.mockResolvedValue([DRAFT_DECISION]);
    tx.publishedSearchDocument.findMany.mockResolvedValue([
      { recordType: "decision", stableId: DECISION_ID },
    ]);
    const repo = new ReportSectionsPrismaRepository({
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService);

    await expect(
      repo.saveSection(sectionOf({}), 1, [deletion("decision", DECISION_ID)]),
    ).rejects.toMatchObject({ code: "PUBLISHED_RECORD_LOCKED" });
    expect(tx.reportSection.updateMany).not.toHaveBeenCalled();
    expect(tx.decision.deleteMany).not.toHaveBeenCalled();
  });
});
