// Carry-over never continues a decision its author has not finished, and never
// touches the private drafts already in the target (openspec:
// lead-incomplete-record-drafts, task 4.7). The source is read as any reader
// but the author sees it, so an unfinished decision is not there to carry.
import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  baseRow,
  fullDecision,
  fullProjectStatus,
  OWNED_PROJECT,
} from "../report-sections/test-seams/index.js";
import { CarryOverPrismaRepository } from "./carry-over.prisma-repository";
import { mergeCarriedIntoTargets, planCarriedEntries } from "./carry-over-plan";
import { persistCarriedRowsForSection } from "./carry-over-row-writes";

const SOURCE_REPORT = "22222222-2222-4222-8222-222222222222";
const TARGET_REPORT = "55555555-5555-4555-8555-555555555555";
const SOURCE_SECTION = "11111111-1111-4111-8111-111111111111";
const TARGET_SECTION = "77777777-7777-4777-8777-777777777777";
const FINISHED = "88888888-8888-4888-8888-888888888881";
const UNFINISHED = "88888888-8888-4888-8888-888888888882";
const TARGET_DRAFT = "88888888-8888-4888-8888-888888888883";
const CARRIED_AT = new Date("2026-05-04T09:30:00.000Z");

const owned = [
  fullProjectStatus({ projectId: OWNED_PROJECT, status: "green" }),
];

function decisionRow(id: string, impact: string | null) {
  return {
    ...fullDecision({
      id,
      productId: OWNED_PROJECT,
      text: `Decision ${id}`,
      project: { name: "Owned Project" },
      stageNames: ["Development"],
    }),
    impact,
  };
}

// The live rows of both periods; the source is still open, so it is read live.
function repositoryOver(targetDecisions: ReturnType<typeof decisionRow>[]) {
  const rowsByReport = new Map([
    [
      SOURCE_REPORT,
      baseRow({
        id: SOURCE_SECTION,
        reportId: SOURCE_REPORT,
        projectStatuses: owned,
        decisions: [
          decisionRow(FINISHED, "Blocks the release"),
          decisionRow(UNFINISHED, null),
        ],
      }),
    ],
    [
      TARGET_REPORT,
      baseRow({
        id: TARGET_SECTION,
        reportId: TARGET_REPORT,
        projectStatuses: owned,
        decisions: targetDecisions,
      }),
    ],
  ]);
  const prisma = {
    report: {
      findUnique: vi.fn().mockResolvedValue({
        periodStatus: "open",
        publishedSnapshot: null,
      }),
    },
    reportSection: {
      findMany: ({ where }: { where: { reportId: string } }) =>
        Promise.resolve([expectDefined(rowsByReport.get(where.reportId))]),
    },
  };
  return new CarryOverPrismaRepository(prisma as never);
}

async function planFrom(repository: CarryOverPrismaRepository) {
  const targets = await repository.getTargetSections(TARGET_REPORT);
  const entries = planCarriedEntries(
    await repository.getSourceSections(SOURCE_REPORT),
    targets,
    {
      sourceReportId: SOURCE_REPORT,
      targetReportId: TARGET_REPORT,
      carriedAt: CARRIED_AT,
    },
  );
  const [planned] = mergeCarriedIntoTargets(targets, entries);
  return { entries, planned: expectDefined(planned) };
}

// The write side only ever reads existing lineage keys and inserts: the fake
// offers no update or delete, so touching a stored row would throw.
function insertOnlyTx(storedStableIds: readonly string[]) {
  const createMany = vi.fn(({ data }: { data: readonly unknown[] }) =>
    Promise.resolve({ count: data.length }),
  );
  const tx = {
    decision: {
      findMany: () =>
        Promise.resolve(
          storedStableIds.map((stableId) => ({ id: stableId, stableId })),
        ),
      createMany,
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, createMany };
}

describe("carry-over and unfinished decisions", () => {
  it("carries the finished unresolved decision once and leaves the unfinished one behind", async () => {
    const { entries } = await planFrom(repositoryOver([]));

    const carried = entries.flatMap((entry) => entry.decisions);
    expect(carried.map((entry) => entry.decision.stableId)).toEqual([FINISHED]);
    expect(carried.map((entry) => entry.record.sourceDecisionId)).toEqual([
      FINISHED,
    ]);
  });

  it("inserts the carried decision beside the target's private draft without touching it", async () => {
    const { planned } = await planFrom(
      repositoryOver([decisionRow(TARGET_DRAFT, null)]),
    );
    const { tx, createMany } = insertOnlyTx([TARGET_DRAFT]);

    const written = await persistCarriedRowsForSection(tx, planned);

    expect(written).toEqual({ insertedItems: 0, insertedDecisions: 1 });
    expect(createMany).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            stableId: FINISHED,
            impact: "Blocks the release",
          }),
        ],
      }),
    );
  });

  it("writes nothing when the target's private draft already continues that decision", async () => {
    // The planner cannot see the private draft, so it plans a clone; the write
    // checks the stored lineage keys and keeps the author's own row.
    const { planned } = await planFrom(
      repositoryOver([decisionRow(FINISHED, null)]),
    );
    const { tx, createMany } = insertOnlyTx([FINISHED]);

    const written = await persistCarriedRowsForSection(tx, planned);

    expect(written).toEqual({ insertedItems: 0, insertedDecisions: 0 });
    expect(createMany).not.toHaveBeenCalled();
  });
});
