import { Prisma } from "@prisma/client";
import {
  type ItemOutcomeResult,
  MAX_RECORDS_PER_SECTION_SAVE,
  type PromotePlanInput,
  type ReportSectionReadModel,
  type ResolvePlanInput,
  type RestorePlanInput,
  validateSubmitInput,
} from "@weeklyreport/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LeadFormConstraintError } from "../domain/lead-form-shared";
import {
  promotePlanTx,
  resolvePlanTx,
  restorePlanTx,
} from "./item-outcome.transaction";

const mocked = vi.hoisted(() => ({
  loadOutcomeTarget: vi.fn(),
  readOutcomeResult: vi.fn(),
  resolveOutcomeSource: vi.fn(),
}));

vi.mock("./item-outcome-source.js", () => ({
  resolveOutcomeSource: mocked.resolveOutcomeSource,
}));
vi.mock("./item-outcome-target.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./item-outcome-target.js")>()),
  loadOutcomeTarget: mocked.loadOutcomeTarget,
  readOutcomeResult: mocked.readOutcomeResult,
}));

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const AUTHOR_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const ACTIVITY_ID = "44444444-4444-4444-8444-444444444444";
const RECORD_ID = "55555555-5555-4555-8555-555555555555";
const STABLE_ID = "66666666-6666-4666-8666-666666666666";
const COMMAND_ID = "77777777-7777-4777-8777-777777777777";
const PRIOR_REPORT_ID = "88888888-8888-4888-8888-888888888888";

type Item = ReportSectionReadModel["items"][number];

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: RECORD_ID,
    stableId: STABLE_ID,
    projectId: PROJECT_ID,
    activityId: null,
    type: "current",
    text: "Current delivery result",
    tag: "delivery",
    workflowStatus: "in_progress",
    carriedOver: true,
    priorityRank: 2,
    pausedReason: null,
    nextStepText: null,
    stageNames: ["Development"],
    comments: [],
    ...overrides,
  };
}

function sectionItems(count: number): readonly Item[] {
  return Array.from({ length: count }, (_, index) => {
    const suffix = String(index + 1).padStart(12, "0");
    return item({
      id: `10000000-0000-4000-8000-${suffix}`,
      stableId: `20000000-0000-4000-8000-${suffix}`,
    });
  });
}

function section(items: readonly Item[] = []): ReportSectionReadModel {
  return {
    reportSectionId: SECTION_ID,
    reportId: "99999999-9999-4999-8999-999999999999",
    authorId: AUTHOR_ID,
    authorName: "Lead",
    authorRole: "lead",
    version: 1,
    status: "draft",
    submittedAt: null,
    late: false,
    projects: [
      {
        projectId: PROJECT_ID,
        projectName: "Payments",
        trafficLight: null,
        ownedStages: [
          {
            stageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            stageName: "Development",
            sortOrder: 1,
            status: null,
          },
        ],
        stageSet: [],
        ownerGroupId: null,
      },
    ],
    referencedProjects: [],
    items,
    risks: [],
    decisions: [],
    activities: [],
    reviews: [],
  };
}

function target(
  targetSection: ReportSectionReadModel,
  replay: ItemOutcomeResult | null = null,
) {
  return {
    section: targetSection,
    actor: { id: AUTHOR_ID, name: "Lead", isActive: true },
    requestHash: "a".repeat(64),
    replay,
  };
}

function transaction() {
  return {
    reportSection: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    item: { create: vi.fn(), update: vi.fn() },
    itemOutcomeEvent: { create: vi.fn() },
  };
}

function prisma(tx: ReturnType<typeof transaction>) {
  return {
    $transaction: vi.fn(
      (callback: (transaction_: typeof tx) => Promise<ItemOutcomeResult>) =>
        callback(tx),
    ),
  };
}

function resolveCommand(
  overrides: Partial<ResolvePlanInput> = {},
): ResolvePlanInput {
  return {
    reportSectionId: SECTION_ID,
    version: 1,
    commandId: COMMAND_ID,
    source: { kind: "current", recordId: RECORD_ID },
    outcome: "done",
    ...overrides,
  };
}

function restoreCommand(
  overrides: Partial<RestorePlanInput> = {},
): RestorePlanInput {
  return {
    reportSectionId: SECTION_ID,
    version: 1,
    commandId: COMMAND_ID,
    recordId: RECORD_ID,
    ...overrides,
  };
}

function promoteCommand(
  overrides: Partial<PromotePlanInput> = {},
): PromotePlanInput {
  return {
    reportSectionId: SECTION_ID,
    version: 1,
    commandId: COMMAND_ID,
    recordId: RECORD_ID,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("item outcome transactions", () => {
  it("keeps a current result while Plan next writes only its next commitment", async () => {
    const source = item();
    const tx = transaction();
    const client = prisma(tx);
    mocked.loadOutcomeTarget.mockResolvedValue(target(section([source])));
    mocked.resolveOutcomeSource.mockResolvedValue(source);
    mocked.readOutcomeResult.mockResolvedValue({
      section: section([source]),
      stableId: STABLE_ID,
      replayed: false,
    });
    tx.itemOutcomeEvent.create.mockResolvedValue({
      id: COMMAND_ID,
      actorId: AUTHOR_ID,
      actorName: "Lead",
      occurredAt: new Date("2026-09-05T12:00:00.000Z"),
    });
    tx.item.update.mockResolvedValue({});

    await resolvePlanTx(
      client as never,
      resolveCommand({
        outcome: "plan_next",
        text: "Verify production metrics",
      }),
      AUTHOR_ID,
    );

    expect(tx.item.create).not.toHaveBeenCalled();
    expect(tx.item.update.mock.calls).toMatchObject([
      [
        {
          where: {
            reportSectionId_stableId: {
              reportSectionId: SECTION_ID,
              stableId: STABLE_ID,
            },
          },
          data: {
            text: "Current delivery result",
            type: "current",
            workflowStatus: "in_progress",
            nextStepText: "Verify production metrics",
          },
        },
      ],
    ]);
  });

  it("creates a prior done occurrence with the server-resolved stable identity", async () => {
    const source = item({
      stableId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      type: "next",
      workflowStatus: "planned",
      carriedOver: false,
    });
    const tx = transaction();
    const client = prisma(tx);
    mocked.loadOutcomeTarget.mockResolvedValue(target(section()));
    mocked.resolveOutcomeSource.mockResolvedValue(source);
    mocked.readOutcomeResult.mockResolvedValue({
      section: section(),
      stableId: source.stableId,
      replayed: false,
    });
    tx.itemOutcomeEvent.create.mockResolvedValue({
      id: COMMAND_ID,
      actorId: AUTHOR_ID,
      actorName: "Lead",
      occurredAt: new Date("2026-09-05T12:00:00.000Z"),
    });
    tx.item.create.mockResolvedValue({});

    await resolvePlanTx(
      client as never,
      resolveCommand({
        source: {
          kind: "prior",
          reportId: PRIOR_REPORT_ID,
          recordId: RECORD_ID,
        },
        outcome: "done",
      }),
      AUTHOR_ID,
    );

    expect(tx.item.update).not.toHaveBeenCalled();
    expect(tx.item.create.mock.calls).toMatchObject([
      [
        {
          data: {
            reportSectionId: SECTION_ID,
            stableId: source.stableId,
            type: "current",
            workflowStatus: "done",
          },
        },
      ],
    ]);
    expect(tx.itemOutcomeEvent.create.mock.calls).toMatchObject([
      [
        {
          data: { stableId: source.stableId, sourceReportId: PRIOR_REPORT_ID },
        },
      ],
    ]);
  });

  it("materializes a prior item when one section slot remains", async () => {
    const source = item({
      stableId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      type: "next",
      workflowStatus: "planned",
      carriedOver: false,
    });
    const tx = transaction();
    const client = prisma(tx);
    mocked.loadOutcomeTarget.mockResolvedValue(
      target(section(sectionItems(MAX_RECORDS_PER_SECTION_SAVE - 1))),
    );
    mocked.resolveOutcomeSource.mockResolvedValue(source);
    mocked.readOutcomeResult.mockResolvedValue({
      section: section(sectionItems(MAX_RECORDS_PER_SECTION_SAVE)),
      stableId: source.stableId,
      replayed: false,
    });
    tx.itemOutcomeEvent.create.mockResolvedValue({
      id: COMMAND_ID,
      actorId: AUTHOR_ID,
      actorName: "Lead",
      occurredAt: new Date("2026-09-05T12:00:00.000Z"),
    });
    tx.item.create.mockResolvedValue({});

    await resolvePlanTx(
      client as never,
      resolveCommand({
        source: {
          kind: "prior",
          reportId: PRIOR_REPORT_ID,
          recordId: RECORD_ID,
        },
        outcome: "done",
      }),
      AUTHOR_ID,
    );

    expect(tx.itemOutcomeEvent.create).toHaveBeenCalledOnce();
    expect(tx.item.create).toHaveBeenCalledOnce();
    expect(tx.item.update).not.toHaveBeenCalled();
  });

  it("rejects prior-item materialization when the section is at capacity", async () => {
    const source = item({
      stableId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      type: "next",
      workflowStatus: "planned",
      carriedOver: false,
    });
    const tx = transaction();
    const client = prisma(tx);
    mocked.loadOutcomeTarget.mockResolvedValue(
      target(section(sectionItems(MAX_RECORDS_PER_SECTION_SAVE))),
    );
    mocked.resolveOutcomeSource.mockResolvedValue(source);

    await expect(
      resolvePlanTx(
        client as never,
        resolveCommand({
          source: {
            kind: "prior",
            reportId: PRIOR_REPORT_ID,
            recordId: RECORD_ID,
          },
          outcome: "done",
        }),
        AUTHOR_ID,
      ),
    ).rejects.toThrow("This section has reached its item limit.");

    expect(tx.itemOutcomeEvent.create).not.toHaveBeenCalled();
    expect(tx.item.create).not.toHaveBeenCalled();
    expect(tx.item.update).not.toHaveBeenCalled();
    expect(mocked.readOutcomeResult).not.toHaveBeenCalled();
  });

  it("allows a current-item mutation when the section is at capacity", async () => {
    const source = item();
    const tx = transaction();
    const client = prisma(tx);
    mocked.loadOutcomeTarget.mockResolvedValue(
      target(
        section([source, ...sectionItems(MAX_RECORDS_PER_SECTION_SAVE - 1)]),
      ),
    );
    mocked.resolveOutcomeSource.mockResolvedValue(source);
    mocked.readOutcomeResult.mockResolvedValue({
      section: section([source]),
      stableId: source.stableId,
      replayed: false,
    });
    tx.itemOutcomeEvent.create.mockResolvedValue({
      id: COMMAND_ID,
      actorId: AUTHOR_ID,
      actorName: "Lead",
      occurredAt: new Date("2026-09-05T12:00:00.000Z"),
    });
    tx.item.update.mockResolvedValue({});

    await resolvePlanTx(client as never, resolveCommand(), AUTHOR_ID);

    expect(tx.itemOutcomeEvent.create).toHaveBeenCalledOnce();
    expect(tx.item.update).toHaveBeenCalledOnce();
    expect(tx.item.create).not.toHaveBeenCalled();
  });

  it("atomically cancels carried work and leaves it ready to submit", async () => {
    const source = item();
    const tx = transaction();
    const client = prisma(tx);
    const occurredAt = new Date("2026-09-05T12:00:00.000Z");
    mocked.loadOutcomeTarget.mockResolvedValue(target(section([source])));
    mocked.resolveOutcomeSource.mockResolvedValue(source);
    mocked.readOutcomeResult.mockResolvedValue({
      section: section([source]),
      stableId: STABLE_ID,
      replayed: false,
    });
    tx.itemOutcomeEvent.create.mockResolvedValue({
      id: COMMAND_ID,
      actorId: AUTHOR_ID,
      actorName: "Lead",
      occurredAt,
    });
    tx.item.update.mockResolvedValue({});

    await resolvePlanTx(
      client as never,
      resolveCommand({ outcome: "wont_do", reason: "The dependency closed." }),
      AUTHOR_ID,
    );

    const write = tx.item.update.mock.calls[0]?.[0] as
      { readonly data: { readonly carriedOver: boolean } } | undefined;
    if (!write) throw new Error("Expected the cancelled item update.");
    const cancelled = { ...source, carriedOver: write.data.carriedOver };
    const submitErrors = validateSubmitInput(section([cancelled]), {
      reportSectionId: SECTION_ID,
      version: 1,
      status: "draft",
      projectStatuses: [{ projectId: PROJECT_ID, status: "green" }],
      stageStatuses: [],
      activityStatuses: [],
      items: [cancelled],
      risks: [],
      decisions: [],
      confirmed: true,
    });
    expect(submitErrors).not.toContainEqual(
      expect.objectContaining({ code: "UNCONFIRMED_CARRIED_ITEM" }),
    );

    expect(tx.item.update.mock.calls).toMatchObject([
      [
        {
          where: {
            reportSectionId_stableId: {
              reportSectionId: SECTION_ID,
              stableId: STABLE_ID,
            },
          },
          data: {
            carriedOver: false,
            resolution: {
              kind: "wont_do",
              eventId: COMMAND_ID,
              reason: "The dependency closed.",
              actorId: AUTHOR_ID,
              actorName: "Lead",
              occurredAt: occurredAt.toISOString(),
              previousState: {
                type: "current",
                workflowStatus: "in_progress",
                pausedReason: null,
                nextStepText: null,
              },
            },
          },
        },
      ],
    ]);
  });

  it("atomically archives the current result and moves its continuation to Next", async () => {
    const source = item({
      workflowStatus: "paused",
      pausedReason: "Waiting for approval.",
      nextStepText: "Validate the integration",
    });
    const tx = transaction();
    const client = prisma(tx);
    mocked.loadOutcomeTarget.mockResolvedValue(target(section([source])));
    mocked.readOutcomeResult.mockResolvedValue({
      section: section([source]),
      stableId: STABLE_ID,
      replayed: false,
    });
    tx.itemOutcomeEvent.create.mockResolvedValue({});
    tx.item.update.mockResolvedValue({});

    await promotePlanTx(
      client as never,
      promoteCommand({ target: "next" }),
      AUTHOR_ID,
    );

    expect(tx.itemOutcomeEvent.create.mock.calls).toMatchObject([
      [
        {
          data: {
            outcome: "plan_next",
            stableId: STABLE_ID,
            beforeState: {
              type: "current",
              workflowStatus: "paused",
              pausedReason: "Waiting for approval.",
              nextStepText: "Validate the integration",
              text: "Current delivery result",
            },
            afterState: {
              type: "next",
              workflowStatus: "paused",
              pausedReason: "Waiting for approval.",
              nextStepText: null,
              text: "Validate the integration",
            },
          },
        },
      ],
    ]);
    expect(tx.item.update).toHaveBeenCalledWith({
      where: {
        reportSectionId_stableId: {
          reportSectionId: SECTION_ID,
          stableId: STABLE_ID,
        },
      },
      data: {
        type: "next",
        workflowStatus: "paused",
        pausedReason: "Waiting for approval.",
        nextStepText: null,
        text: "Validate the integration",
        carriedOver: false,
        resolution: Prisma.DbNull,
      },
    });
    expect(tx.item.create).not.toHaveBeenCalled();
  });

  it("restores the stored tuple, clears resolution and records its reversal", async () => {
    const cancelled = item({
      resolution: {
        kind: "wont_do",
        eventId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        reason: "Paused indefinitely.",
        actorId: AUTHOR_ID,
        actorName: "Lead",
        occurredAt: "2026-09-05T11:00:00.000Z",
        previousState: {
          type: "current",
          workflowStatus: "paused",
          pausedReason: "Waiting for approval.",
          nextStepText: null,
          text: null,
        },
      },
    });
    const tx = transaction();
    const client = prisma(tx);
    mocked.loadOutcomeTarget.mockResolvedValue(target(section([cancelled])));
    mocked.readOutcomeResult.mockResolvedValue({
      section: section([cancelled]),
      stableId: STABLE_ID,
      replayed: false,
    });
    tx.itemOutcomeEvent.create.mockResolvedValue({});
    tx.item.update.mockResolvedValue({});

    await restorePlanTx(client as never, restoreCommand(), AUTHOR_ID);

    expect(tx.itemOutcomeEvent.create.mock.calls).toMatchObject([
      [
        {
          data: {
            outcome: "restore",
            reversesEventId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          },
        },
      ],
    ]);
    expect(tx.item.update).toHaveBeenCalledWith({
      where: {
        reportSectionId_stableId: {
          reportSectionId: SECTION_ID,
          stableId: STABLE_ID,
        },
      },
      data: {
        type: "current",
        workflowStatus: "paused",
        pausedReason: "Waiting for approval.",
        nextStepText: null,
        // The stored event predates retained text, so the live result is kept.
        text: "Current delivery result",
        resolution: Prisma.DbNull,
      },
    });
  });

  it("returns a replay without item or event writes", async () => {
    const replay: ItemOutcomeResult = {
      section: section(),
      stableId: STABLE_ID,
      replayed: true,
    };
    const tx = transaction();
    const client = prisma(tx);
    mocked.loadOutcomeTarget.mockResolvedValue(target(section(), replay));

    await expect(
      resolvePlanTx(client as never, resolveCommand(), AUTHOR_ID),
    ).resolves.toEqual(replay);
    expect(mocked.resolveOutcomeSource).not.toHaveBeenCalled();
    expect(tx.item.create).not.toHaveBeenCalled();
    expect(tx.item.update).not.toHaveBeenCalled();
    expect(tx.itemOutcomeEvent.create).not.toHaveBeenCalled();
  });

  it("propagates a duplicate-source rejection before item or event writes", async () => {
    const tx = transaction();
    const client = prisma(tx);
    mocked.loadOutcomeTarget.mockResolvedValue(target(section()));
    mocked.resolveOutcomeSource.mockRejectedValue(
      new LeadFormConstraintError(
        "This plan already has a current occurrence.",
      ),
    );

    await expect(
      resolvePlanTx(
        client as never,
        resolveCommand({
          source: {
            kind: "prior",
            reportId: PRIOR_REPORT_ID,
            recordId: RECORD_ID,
          },
        }),
        AUTHOR_ID,
      ),
    ).rejects.toBeInstanceOf(LeadFormConstraintError);
    expect(tx.item.create).not.toHaveBeenCalled();
    expect(tx.itemOutcomeEvent.create).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "unowned stage",
      source: item({ stageNames: ["Unowned"] }),
      command: resolveCommand(),
    },
    {
      name: "invalid dual parent",
      source: item({ activityId: ACTIVITY_ID }),
      command: resolveCommand(),
    },
  ])("rejects $name before creating an event", async ({ source, command }) => {
    const tx = transaction();
    const client = prisma(tx);
    mocked.loadOutcomeTarget.mockResolvedValue(target(section()));
    mocked.resolveOutcomeSource.mockResolvedValue(source);

    await expect(
      resolvePlanTx(client as never, command, AUTHOR_ID),
    ).rejects.toBeInstanceOf(Error);
    expect(tx.item.create).not.toHaveBeenCalled();
    expect(tx.item.update).not.toHaveBeenCalled();
    expect(tx.itemOutcomeEvent.create).not.toHaveBeenCalled();
  });

  it("resolves a stored item whose stage the author no longer owns", async () => {
    const source = item({ stageNames: ["Unowned"] });
    const tx = transaction();
    const client = prisma(tx);
    mocked.loadOutcomeTarget.mockResolvedValue(target(section([source])));
    mocked.resolveOutcomeSource.mockResolvedValue(source);
    mocked.readOutcomeResult.mockResolvedValue({
      section: section([source]),
      stableId: STABLE_ID,
      replayed: false,
    });
    tx.itemOutcomeEvent.create.mockResolvedValue({
      id: COMMAND_ID,
      actorId: AUTHOR_ID,
      actorName: "Lead",
      occurredAt: new Date("2026-09-05T12:00:00.000Z"),
    });
    tx.item.update.mockResolvedValue({});

    await resolvePlanTx(
      client as never,
      resolveCommand({ outcome: "plan_next", text: "Verify metrics" }),
      AUTHOR_ID,
    );

    expect(tx.item.update).toHaveBeenCalledTimes(1);
  });

  it("rejects an outcome whose item gains an unowned stage over the stored one", async () => {
    const tx = transaction();
    const client = prisma(tx);
    mocked.loadOutcomeTarget.mockResolvedValue(target(section([item()])));
    mocked.resolveOutcomeSource.mockResolvedValue(
      item({ stageNames: ["Development", "Unowned"] }),
    );

    await expect(
      resolvePlanTx(client as never, resolveCommand(), AUTHOR_ID),
    ).rejects.toMatchObject({ code: "STAGE_NOT_OWNED" });
    expect(tx.item.update).not.toHaveBeenCalled();
    expect(tx.itemOutcomeEvent.create).not.toHaveBeenCalled();
  });

  it("propagates a transaction callback failure without claiming a rollback", async () => {
    const source = item();
    const tx = transaction();
    const client = prisma(tx);
    const failure = new Error("item write failed");
    mocked.loadOutcomeTarget.mockResolvedValue(target(section([source])));
    mocked.resolveOutcomeSource.mockResolvedValue(source);
    tx.itemOutcomeEvent.create.mockResolvedValue({
      id: COMMAND_ID,
      actorId: AUTHOR_ID,
      actorName: "Lead",
      occurredAt: new Date("2026-09-05T12:00:00.000Z"),
    });
    tx.item.update.mockRejectedValue(failure);

    await expect(
      resolvePlanTx(client as never, resolveCommand(), AUTHOR_ID),
    ).rejects.toBe(failure);
    expect(mocked.readOutcomeResult).not.toHaveBeenCalled();
    expect(client.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 15_000,
    });
  });
});
