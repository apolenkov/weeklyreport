// A decision the published report already shows keeps its Impact when the
// period is reopened (openspec: report-section-write-gates, "Published
// decisions retain complete content"). The frozen report is that decision's
// only witness, so an emptied one would vanish from the next publication.
import type { PrismaReportSectionWithRelations } from "@weeklyreport/report-persistence";
import { mapPrismaToAuthorReportSection } from "@weeklyreport/report-persistence";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import type { FabricatedRow } from "./__tests__/report-sections-prisma-harness";
import {
  baseRow,
  fullDecision,
  OWNED_PROJECT,
} from "./__tests__/report-sections-prisma-harness";
import { makeSaveTx, OPEN_LIFECYCLE_ROW } from "./__tests__/save-section-tx";
import { ReportSectionsPrismaRepository } from "./report-sections.prisma-repository";

const DECISION_ID = "99999999-9999-4999-8999-999999999999";
const REOPENED = {
  ...OPEN_LIFECYCLE_ROW,
  status: "published",
  periodStatus: "reopened",
  publishedAt: new Date("2026-09-04T18:00:00.000Z"),
  reopenedAt: new Date("2026-09-04T19:00:00.000Z"),
};

const decisionRow = (impact: string | null) => ({
  ...fullDecision({
    productId: OWNED_PROJECT,
    project: { name: "Owned Project" },
    stageNames: ["Development"],
  }),
  impact,
});

const sectionOf = (records: Partial<FabricatedRow>) =>
  mapPrismaToAuthorReportSection(
    baseRow(records) as unknown as PrismaReportSectionWithRelations,
  );

function setup(published: boolean) {
  const tx = makeSaveTx(1, baseRow({ version: 2 }), [REOPENED]);
  tx.decision.findMany.mockResolvedValue([decisionRow("Scope moves")]);
  tx.publishedSearchDocument.findMany.mockResolvedValue(
    published ? [{ recordType: "decision", stableId: DECISION_ID }] : [],
  );
  const repo = new ReportSectionsPrismaRepository({
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService);
  return { repo, tx };
}

describe("saveSection — a published decision keeps its Impact", () => {
  it("rejects clearing the Impact before the version or any row is touched", async () => {
    const { repo, tx } = setup(true);

    await expect(
      repo.saveSection(sectionOf({ decisions: [decisionRow(null)] }), 1),
    ).rejects.toMatchObject({
      code: "PUBLISHED_RECORD_LOCKED",
      message: expect.stringContaining("Impact") as unknown,
    });

    // Nothing moved: version, the stored decision and its comments stay.
    expect(tx.reportSection.updateMany).not.toHaveBeenCalled();
    expect(tx.decision.deleteMany).not.toHaveBeenCalled();
    expect(tx.recordComment.findMany).not.toHaveBeenCalled();
  });

  it("saves the same decision when its Impact is kept", async () => {
    const { repo, tx } = setup(true);

    await expect(
      repo.saveSection(sectionOf({ decisions: [decisionRow("New scope")] }), 1),
    ).resolves.toMatchObject({ version: 2 });

    expect(tx.decision.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ stableId: DECISION_ID, impact: "New scope" }),
      ],
    });
  });

  it("lets a never-published decision lose its Impact and stay as a draft", async () => {
    const { repo, tx } = setup(false);

    await expect(
      repo.saveSection(sectionOf({ decisions: [decisionRow(null)] }), 1),
    ).resolves.toMatchObject({ version: 2 });

    expect(tx.decision.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ stableId: DECISION_ID, impact: null })],
    });
  });

  it("lets a complete never-published decision be dropped without a deletion intent", async () => {
    const { repo, tx } = setup(false);

    await expect(repo.saveSection(sectionOf({}), 1)).resolves.toMatchObject({
      version: 2,
    });

    expect(tx.decision.deleteMany).toHaveBeenCalled();
  });
});
