import {
  type ReportSectionReadModel,
  type SubmitSectionPayload,
} from "@customreport/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import {
  ReportSectionAccessError,
  ReportSectionsService,
} from "../application/report-sections.service";
import { NOOP_REPORT_SECTIONS_TELEMETRY } from "../application/report-sections-telemetry.port.js";
import {
  baseRow,
  fullItem,
  fullProjectStatus,
  mapRow,
  OWNED_PROJECT,
} from "./__tests__/report-sections-prisma-harness";
import { ReportSectionsPrismaRepository } from "./report-sections.prisma-repository";

const NOW = new Date("2026-09-30T10:00:00.000Z");
const BEFORE = new Date("2026-09-28T10:00:00.000Z");
const AFTER = new Date("2026-10-01T10:00:00.000Z");

function createSubmission(
  initial: {
    deadline: Date | null;
    gracePeriodHours: number;
    allowLateSubmissions: boolean;
  },
  afterLock: Partial<typeof initial>,
) {
  let deadline = initial.deadline;
  let settings = {
    gracePeriodHours: initial.gracePeriodHours,
    allowLateSubmissions: initial.allowLateSubmissions,
  };
  let row = baseRow({
    projectStatuses: [
      fullProjectStatus({ projectId: OWNED_PROJECT, status: "green" }),
    ],
    items: [
      fullItem({
        projectId: OWNED_PROJECT,
        stageNames: ["Development"],
        project: { name: "Owned Project" },
      }),
    ],
  });
  const clear = vi.fn(() => Promise.resolve({ count: 0 }));
  const tx = {
    $executeRaw: vi.fn(() => {
      deadline =
        afterLock.deadline === undefined ? deadline : afterLock.deadline;
      settings = { ...settings, ...afterLock };
      return Promise.resolve(0);
    }),
    $queryRaw: vi.fn(() =>
      Promise.resolve([
        {
          id: row.reportId,
          status: "draft",
          periodState: "open",
          periodStatus: "open",
          archived: false,
          autoPublished: false,
          autoArchived: false,
          publishedAt: null,
          publishedById: null,
          reopenedAt: null,
        },
      ]),
    ),
    appSettings: {
      findUnique: vi.fn<() => Promise<typeof settings | null>>(() =>
        Promise.resolve(settings),
      ),
    },
    report: {
      findUnique: vi.fn<
        () => Promise<{ status: string; deadline: Date | null } | null>
      >(() => Promise.resolve({ status: "draft", deadline })),
      findMany: vi.fn(() => Promise.resolve([])),
    },
    reportSection: {
      updateMany: vi.fn(
        (input: {
          data: Pick<ReportSectionReadModel, "status" | "late" | "submittedAt">;
        }) => {
          row = { ...row, ...input.data, version: row.version + 1 };
          return Promise.resolve({ count: 1 });
        },
      ),
      findUnique: vi.fn(() => Promise.resolve(row)),
    },
    projectStatus: {
      deleteMany: clear,
      createMany: vi.fn(() => Promise.resolve({ count: 1 })),
    },
    stageStatus: {
      deleteMany: clear,
      createMany: vi.fn(() => Promise.resolve({ count: 1 })),
    },
    activityStatus: {
      deleteMany: clear,
      createMany: vi.fn(() => Promise.resolve({ count: 0 })),
    },
    item: {
      findMany: vi.fn(() => Promise.resolve([])),
      deleteMany: clear,
      createMany: vi.fn(() => Promise.resolve({ count: 1 })),
    },
    risk: {
      deleteMany: clear,
      createMany: vi.fn(() => Promise.resolve({ count: 0 })),
    },
    decision: {
      findMany: vi.fn(() => Promise.resolve([])),
      deleteMany: clear,
      createMany: vi.fn(() => Promise.resolve({ count: 0 })),
    },
    recordComment: {
      findMany: vi.fn(() => Promise.resolve([])),
      createMany: vi.fn(() => Promise.resolve({ count: 0 })),
    },
    publishedSearchDocument: { findMany: vi.fn(() => Promise.resolve([])) },
  };
  const prisma = {
    $transaction: vi.fn((run: (client: typeof tx) => unknown) => run(tx)),
    reportSection: {
      findUnique: vi.fn(() =>
        Promise.resolve({
          ...row,
          report: { periodStatus: "open", archived: false },
        }),
      ),
    },
    report: {
      findUnique: vi.fn(() => Promise.resolve({ status: "draft", deadline })),
    },
  };
  const repository = new ReportSectionsPrismaRepository(
    prisma as unknown as PrismaService,
  );
  vi.spyOn(repository, "getPublishedLineage").mockResolvedValue({
    itemStableIds: [],
    decisionStableIds: [],
  });
  const telemetry = {
    ...NOOP_REPORT_SECTIONS_TELEMETRY,
    recordSectionSubmitted: vi.fn(),
    observeSubmissionLatency: vi.fn(),
  };
  const service = new ReportSectionsService(repository, telemetry);
  const payload: SubmitSectionPayload = {
    reportSectionId: row.id,
    version: 1,
    status: "draft",
    confirmed: true,
    projectStatuses: [{ projectId: OWNED_PROJECT, status: "green" }],
    stageStatuses: [],
    activityStatuses: [],
    items: mapRow(row).items,
    risks: [],
    decisions: [],
  };
  return {
    submit: () => service.submitSection(payload, row.authorId),
    tx,
    telemetry,
    repository,
    section: mapRow(row),
  };
}

describe("section submission deadline under the report write lock", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it("rejects a shortened deadline before the version or children change", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const { submit, tx } = createSubmission(
      { deadline: AFTER, gracePeriodHours: 0, allowLateSubmissions: false },
      { deadline: BEFORE },
    );

    await expect(submit()).rejects.toBeInstanceOf(ReportSectionAccessError);
    expect(tx.reportSection.updateMany).not.toHaveBeenCalled();
    expect(tx.item.deleteMany).not.toHaveBeenCalled();
  });

  it("accepts a deadline extension committed before the submit lock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const { submit, tx, telemetry } = createSubmission(
      { deadline: BEFORE, gracePeriodHours: 0, allowLateSubmissions: false },
      { deadline: AFTER },
    );

    await expect(submit()).resolves.toMatchObject({
      status: "submitted",
      late: false,
      version: 2,
    });
    expect(tx.reportSection.updateMany).toHaveBeenCalledOnce();
    expect(telemetry.recordSectionSubmitted).toHaveBeenCalledWith(false);
    expect(telemetry.observeSubmissionLatency).toHaveBeenCalledWith(-86_400);
  });

  it.each([
    {
      gracePeriodHours: 0,
      allowLateSubmissions: true,
      changed: { allowLateSubmissions: false },
    },
    {
      gracePeriodHours: 72,
      allowLateSubmissions: false,
      changed: { gracePeriodHours: 0 },
    },
  ])(
    "uses current grace and late-submission settings after the lock",
    async ({ gracePeriodHours, allowLateSubmissions, changed }) => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
      const { submit, tx } = createSubmission(
        { deadline: BEFORE, gracePeriodHours, allowLateSubmissions },
        changed,
      );

      await expect(submit()).rejects.toBeInstanceOf(ReportSectionAccessError);
      expect(tx.reportSection.updateMany).not.toHaveBeenCalled();
      expect(tx.item.deleteMany).not.toHaveBeenCalled();
    },
  );

  it("recomputes late=false when an admin clears the deadline before the lock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const { submit, telemetry } = createSubmission(
      { deadline: BEFORE, gracePeriodHours: 0, allowLateSubmissions: true },
      { deadline: null },
    );

    await expect(submit()).resolves.toMatchObject({ late: false });
    expect(telemetry.recordSectionSubmitted).toHaveBeenCalledWith(false);
    expect(telemetry.observeSubmissionLatency).not.toHaveBeenCalled();
  });
  it("applies the deadline gate to direct repository submissions too", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const { repository, section, tx } = createSubmission(
      { deadline: BEFORE, gracePeriodHours: 0, allowLateSubmissions: false },
      {},
    );

    await expect(
      repository.saveSection(
        { ...section, status: "submitted" },
        section.version,
      ),
    ).rejects.toBeInstanceOf(ReportSectionAccessError);
    expect(tx.reportSection.updateMany).not.toHaveBeenCalled();
    expect(tx.item.deleteMany).not.toHaveBeenCalled();
  });

  it("fails closed when the current policy singleton is absent", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const { submit, tx } = createSubmission(
      { deadline: AFTER, gracePeriodHours: 0, allowLateSubmissions: false },
      {},
    );
    tx.appSettings.findUnique.mockResolvedValue(null);

    await expect(submit()).rejects.toThrow(
      "AppSettings singleton row 'singleton' is missing",
    );
    expect(tx.reportSection.updateMany).not.toHaveBeenCalled();
    expect(tx.item.deleteMany).not.toHaveBeenCalled();
  });

  it("a cleared deadline does not read settings or require their singleton", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const { submit, tx } = createSubmission(
      { deadline: null, gracePeriodHours: 0, allowLateSubmissions: false },
      {},
    );
    tx.appSettings.findUnique.mockResolvedValue(null);

    await expect(submit()).resolves.toMatchObject({
      status: "submitted",
      late: false,
    });
    expect(tx.appSettings.findUnique).not.toHaveBeenCalled();
  });
  it("stamps submittedAt and late from the same clock after waiting for the report lock", async () => {
    vi.useFakeTimers();
    const requestTime = new Date(NOW.getTime() - 60_000);
    const lockedTime = new Date(NOW.getTime() + 60_000);
    vi.setSystemTime(requestTime);
    const { submit, tx, repository } = createSubmission(
      { deadline: NOW, gracePeriodHours: 1, allowLateSubmissions: false },
      {},
    );
    const persist = vi.spyOn(repository, "saveSection");
    const lifecycle = await tx.$queryRaw();
    const waiting = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    tx.$queryRaw.mockImplementation(async () => {
      waiting.resolve();
      await release.promise;
      return lifecycle;
    });
    let pending: ReturnType<typeof submit> | undefined;
    try {
      pending = submit();
      void pending.catch(() => undefined);
      await waiting.promise;
      vi.setSystemTime(lockedTime);
      release.resolve();
      const saved = await pending;

      expect(persist.mock.calls[0]?.[0].submittedAt).toEqual(requestTime);
      expect(saved.late).toBe(true);
      expect(saved.submittedAt).toEqual(lockedTime);
      expect(tx.reportSection.updateMany.mock.calls).toMatchObject([
        [{ data: { late: true, submittedAt: lockedTime } }],
      ]);
    } finally {
      release.resolve();
      if (pending) await Promise.allSettled([pending]);
      vi.useRealTimers();
    }
  });
});
