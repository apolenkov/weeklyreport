import type {
  PromotePlanInput,
  ResolvePlanInput,
  RestorePlanInput,
} from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { SectionVersionConflictError } from "../application/report-sections.service";
import {
  LeadFormConstraintError,
  LeadFormDomainError,
} from "../domain/lead-form-shared";
import {
  AUTHOR_ID,
  baseRow,
  type FabricatedRow,
  SECTION_ID,
} from "./__tests__/report-sections-prisma-harness";
import { outcomeCommandHash } from "./item-outcome-command-hash";
import {
  advanceOutcomeVersion,
  loadOutcomeTarget,
} from "./item-outcome-target";

const COMMAND_ID = "44444444-4444-4444-8444-444444444444";
const RECORD_ID = "55555555-5555-4555-8555-555555555555";
const OTHER_USER_ID = "66666666-6666-4666-8666-666666666666";
const OTHER_COMMAND_ID = "99999999-9999-4999-8999-999999999999";

const command: ResolvePlanInput = {
  reportSectionId: SECTION_ID,
  version: 1,
  commandId: COMMAND_ID,
  source: { kind: "current", recordId: RECORD_ID },
  outcome: "done",
};

const EDITABLE_REPORT = {
  id: "77777777-7777-4777-8777-777777777777",
  status: "draft",
  periodState: "open",
  periodStatus: "open",
  archived: false,
  autoPublished: false,
  autoArchived: false,
  publishedAt: null,
  publishedById: null,
  reopenedAt: null,
};

interface Receipt {
  readonly reportSectionId: string;
  readonly stableId: string;
  readonly actorId: string;
  readonly requestHash: string;
  readonly outcome?: string;
}

function createTransaction({
  row = baseRow(),
  report = EDITABLE_REPORT,
  actor = { id: AUTHOR_ID, name: "Lead 1", isActive: true },
  receipt = null,
  updateCount = 1,
}: {
  readonly row?: FabricatedRow | null;
  readonly report?: typeof EDITABLE_REPORT;
  readonly actor?: {
    readonly id: string;
    readonly name: string;
    readonly isActive: boolean;
  } | null;
  readonly receipt?: Receipt | null;
  readonly updateCount?: number;
} = {}) {
  const calls: string[] = [];
  const transaction = {
    $executeRaw: vi.fn((sql: TemplateStringsArray) => {
      calls.push(
        sql.join("").includes("lock_timeout") ? "lock timeout" : "status graph",
      );
      return Promise.resolve(0);
    }),
    $queryRaw: vi.fn(() => {
      calls.push("report");
      return Promise.resolve([report]);
    }),
    reportSection: {
      findUnique: vi.fn(() => {
        calls.push("section");
        return Promise.resolve(row);
      }),
      updateMany: vi.fn(() => {
        calls.push("CAS");
        return Promise.resolve({ count: updateCount });
      }),
    },
    user: {
      findUnique: vi.fn(() => {
        calls.push("actor");
        return Promise.resolve(actor);
      }),
    },
    itemOutcomeEvent: {
      findUnique: vi.fn(() => {
        calls.push("receipt");
        return Promise.resolve(receipt);
      }),
      create: vi.fn(),
    },
    item: { create: vi.fn() },
  };
  return { calls, transaction };
}

describe("loadOutcomeTarget", () => {
  it("rejects an author-spoofed command before loading an actor or mutating", async () => {
    const { transaction } = createTransaction({
      row: baseRow({ authorId: OTHER_USER_ID }),
    });

    await expect(
      loadOutcomeTarget(transaction as never, command, AUTHOR_ID, "resolve"),
    ).rejects.toBeInstanceOf(LeadFormDomainError);
    expect(transaction.user.findUnique).not.toHaveBeenCalled();
    expect(transaction.reportSection.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an inactive author before inspecting command receipts", async () => {
    const { transaction } = createTransaction({
      actor: { id: AUTHOR_ID, name: "Lead 1", isActive: false },
    });

    await expect(
      loadOutcomeTarget(transaction as never, command, AUTHOR_ID, "resolve"),
    ).rejects.toBeInstanceOf(LeadFormDomainError);
    expect(transaction.itemOutcomeEvent.findUnique).not.toHaveBeenCalled();
    expect(transaction.reportSection.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "submitted section",
      row: baseRow({ status: "submitted" }),
      report: EDITABLE_REPORT,
    },
    {
      name: "read-only report",
      row: baseRow(),
      report: {
        ...EDITABLE_REPORT,
        status: "published",
        periodState: "published",
        periodStatus: "published",
      },
    },
  ])("rejects a new command in a $name before CAS", async ({ row, report }) => {
    const { transaction } = createTransaction({ row, report });

    await expect(
      loadOutcomeTarget(transaction as never, command, AUTHOR_ID, "resolve"),
    ).rejects.toBeInstanceOf(LeadFormConstraintError);
    expect(transaction.itemOutcomeEvent.findUnique).toHaveBeenCalledOnce();
    expect(transaction.reportSection.updateMany).not.toHaveBeenCalled();
  });

  it("returns a matching receipt replay before a stale-version CAS", async () => {
    const stableId = "88888888-8888-4888-8888-888888888888";
    const { transaction } = createTransaction({
      row: baseRow({ version: 2 }),
      receipt: {
        reportSectionId: SECTION_ID,
        stableId,
        actorId: AUTHOR_ID,
        requestHash: outcomeCommandHash(command, "resolve"),
      },
      updateCount: 0,
    });

    const target = await loadOutcomeTarget(
      transaction as never,
      command,
      AUTHOR_ID,
      "resolve",
    );

    expect(target.replay).toMatchObject({ stableId, replayed: true });
    expect(transaction.reportSection.updateMany).not.toHaveBeenCalled();
  });

  it("replays an applied command after publication without another write", async () => {
    const { transaction } = createTransaction({
      row: baseRow({ status: "submitted", version: 2 }),
      report: {
        ...EDITABLE_REPORT,
        status: "published",
        periodState: "published",
        periodStatus: "published",
      },
      receipt: {
        reportSectionId: SECTION_ID,
        stableId: RECORD_ID,
        actorId: AUTHOR_ID,
        requestHash: outcomeCommandHash(command, "resolve"),
      },
      updateCount: 0,
    });
    const target = await loadOutcomeTarget(
      transaction as never,
      command,
      AUTHOR_ID,
      "resolve",
    );
    expect(target.replay).toMatchObject({
      stableId: RECORD_ID,
      replayed: true,
    });
    expect(transaction.reportSection.updateMany).not.toHaveBeenCalled();
  });

  it("scopes receipt replay to the matching command id, not the shared intent", async () => {
    const stableId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const sameIntent: ResolvePlanInput = {
      ...command,
      commandId: OTHER_COMMAND_ID,
    };
    const requestHash = outcomeCommandHash(command, "resolve");
    expect(outcomeCommandHash(sameIntent, "resolve")).toBe(requestHash);

    const receipt = {
      reportSectionId: SECTION_ID,
      stableId,
      actorId: AUTHOR_ID,
      requestHash,
    };
    const { transaction } = createTransaction();
    transaction.itemOutcomeEvent.findUnique.mockImplementation(
      (args?: { where: { id: string } }) =>
        Promise.resolve(args?.where.id === COMMAND_ID ? receipt : null),
    );

    const replayed = await loadOutcomeTarget(
      transaction as never,
      command,
      AUTHOR_ID,
      "resolve",
    );
    const fresh = await loadOutcomeTarget(
      transaction as never,
      sameIntent,
      AUTHOR_ID,
      "resolve",
    );

    expect(replayed.replay).toMatchObject({ stableId, replayed: true });
    expect(transaction.itemOutcomeEvent.findUnique).toHaveBeenNthCalledWith(1, {
      where: { id: COMMAND_ID },
    });
    expect(fresh.replay).toBeNull();
    expect(fresh.requestHash).toBe(requestHash);
    expect(transaction.itemOutcomeEvent.findUnique).toHaveBeenNthCalledWith(2, {
      where: { id: OTHER_COMMAND_ID },
    });
    expect(transaction.reportSection.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "changed intent",
      receipt: {
        reportSectionId: SECTION_ID,
        stableId: RECORD_ID,
        actorId: AUTHOR_ID,
        requestHash: "0".repeat(64),
      },
    },
    {
      name: "another actor",
      receipt: {
        reportSectionId: SECTION_ID,
        stableId: RECORD_ID,
        actorId: OTHER_USER_ID,
        requestHash: outcomeCommandHash(command, "resolve"),
      },
    },
  ])("rejects a receipt bound to $name", async ({ receipt }) => {
    const { transaction } = createTransaction({ receipt });

    await expect(
      loadOutcomeTarget(transaction as never, command, AUTHOR_ID, "resolve"),
    ).rejects.toBeInstanceOf(LeadFormConstraintError);
    expect(transaction.reportSection.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a Restore receipt reused at the promotion endpoint", async () => {
    const promotion: PromotePlanInput = {
      reportSectionId: SECTION_ID,
      version: 2,
      commandId: COMMAND_ID,
      recordId: RECORD_ID,
    };
    const { transaction } = createTransaction({
      row: baseRow({ version: 2 }),
      receipt: {
        reportSectionId: SECTION_ID,
        stableId: RECORD_ID,
        actorId: AUTHOR_ID,
        requestHash: outcomeCommandHash(promotion, "restore"),
        outcome: "restore",
      },
    });

    await expect(
      loadOutcomeTarget(transaction as never, promotion, AUTHOR_ID, "promote"),
    ).rejects.toBeInstanceOf(LeadFormConstraintError);
  });

  it("rejects a legacy promotion receipt reused at the Restore endpoint", async () => {
    const restore: RestorePlanInput = {
      reportSectionId: SECTION_ID,
      version: 2,
      commandId: COMMAND_ID,
      recordId: RECORD_ID,
    };
    const { transaction } = createTransaction({
      row: baseRow({ version: 2 }),
      receipt: {
        reportSectionId: SECTION_ID,
        stableId: RECORD_ID,
        actorId: AUTHOR_ID,
        requestHash: outcomeCommandHash(restore, "restore"),
        outcome: "promote",
      },
    });

    await expect(
      loadOutcomeTarget(transaction as never, restore, AUTHOR_ID, "restore"),
    ).rejects.toBeInstanceOf(LeadFormConstraintError);
  });

  it("fails a stale command before any item or outcome-event write", async () => {
    const { transaction } = createTransaction({ row: baseRow({ version: 2 }) });

    await expect(
      loadOutcomeTarget(transaction as never, command, AUTHOR_ID, "resolve"),
    ).rejects.toBeInstanceOf(SectionVersionConflictError);
    expect(transaction.item.create).not.toHaveBeenCalled();
    expect(transaction.itemOutcomeEvent.create).not.toHaveBeenCalled();
  });

  it("rejects a failed version compare-and-set before item writes", async () => {
    const { transaction } = createTransaction({ updateCount: 0 });

    await expect(
      advanceOutcomeVersion(transaction as never, command),
    ).rejects.toBeInstanceOf(SectionVersionConflictError);
    expect(transaction.reportSection.updateMany).toHaveBeenCalledWith({
      where: { id: SECTION_ID, version: command.version, status: "draft" },
      data: { version: { increment: 1 } },
    });
    expect(transaction.item.create).not.toHaveBeenCalled();
    expect(transaction.itemOutcomeEvent.create).not.toHaveBeenCalled();
  });

  it("loads the locked target without writing before source locks are acquired", async () => {
    const { calls, transaction } = createTransaction();

    const target = await loadOutcomeTarget(
      transaction as never,
      command,
      AUTHOR_ID,
      "resolve",
    );

    expect(target.replay).toBeNull();
    expect(calls).toEqual([
      "lock timeout",
      "status graph",
      "report",
      "section",
      "actor",
      "receipt",
    ]);
    expect(transaction.reportSection.updateMany).not.toHaveBeenCalled();
  });
});
