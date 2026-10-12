import type { AppSettings } from "@customreport/shared";
import type { Report } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import type { AuditLogger } from "../../../lib/audit-logger.js";
import { createNullAuditLogger } from "../../../test-utils/audit-logger.js";
import { silenceNestLogger } from "../../../test-utils/silence-logs";
import type { SnapshotAdminService } from "../../admin/index.js";
import type { PublicationService } from "../../publication/index.js";
import { AutoPublisherScheduler } from "./auto-publisher.scheduler.js";

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    autoCreatePeriods: false,
    defaultDeadlineDays: 4,
    periodLengthDays: 7,
    workingDays: "mon-fri",
    gracePeriodHours: 2,
    allowLateSubmissions: true,
    autoPublishAfterDeadline: true,
    autoArchiveWeeksAfterPublish: 0,
    defaultTimezone: "Europe/Moscow",
    defaultReminderAudience: "lead-with-draft",
    notificationFromEmail: null,
    // period-cycle knobs at SQL defaults.
    deadlineTime: "18:00",
    allowReopenAfterPublish: true,
    reopenWindowHours: 72,
    unifiedActivityView: false,
    ...overrides,
  };
}

type SchedulerReportFindMany = (
  ...args: Parameters<PrismaService["report"]["findMany"]>
) => Promise<readonly Pick<Report, "id" | "deadline">[]>;
type SchedulerReportSectionCount = (
  ...args: Parameters<PrismaService["reportSection"]["count"]>
) => Promise<number>;
type PublishAutoResult = Awaited<ReturnType<PublicationService["publishAuto"]>>;
type SchedulerPublishAutoResult =
  | Pick<Extract<PublishAutoResult, { published: false }>, "published">
  | (Pick<
      Extract<PublishAutoResult, { published: true }>,
      "published" | "wasAlreadyPublished"
    > & {
      readonly report: {
        readonly sections: readonly {
          readonly status: "draft" | "submitted";
        }[];
      };
    });
type SchedulerPublishAuto = (
  ...args: Parameters<PublicationService["publishAuto"]>
) => Promise<SchedulerPublishAutoResult>;

interface SchedulerPrismaStub {
  readonly report: { readonly findMany: SchedulerReportFindMany };
  readonly reportSection: { readonly count: SchedulerReportSectionCount };
}

interface SchedulerPublicationStub {
  readonly publishAuto: SchedulerPublishAuto;
}

function createScheduler(
  prisma: SchedulerPrismaStub,
  admin: Pick<SnapshotAdminService, "getSettings">,
  publication: SchedulerPublicationStub,
  audit: Pick<AuditLogger, "periodAutoPublish">,
): AutoPublisherScheduler {
  return new AutoPublisherScheduler(
    prisma as unknown as PrismaService,
    admin as unknown as SnapshotAdminService,
    publication as unknown as PublicationService,
    audit as AuditLogger,
  );
}

const mockReportFindMany = () => vi.fn<SchedulerReportFindMany>();
const mockReportSectionCount = () => vi.fn<SchedulerReportSectionCount>();
const mockGetSettings = () => vi.fn<SnapshotAdminService["getSettings"]>();
const mockPublishAuto = () => vi.fn<SchedulerPublishAuto>();
const mockPeriodAutoPublish = () => vi.fn<AuditLogger["periodAutoPublish"]>();

const overdueDeadline = new Date("2026-05-01T15:00:00.000Z");

describe("AutoPublisherScheduler", () => {
  it("skip-when-disabled: autoPublishAfterDeadline=false → no DB scan", async () => {
    const prisma = {
      report: { findMany: mockReportFindMany() },
      reportSection: { count: mockReportSectionCount() },
    };
    const admin = {
      getSettings: mockGetSettings().mockResolvedValue(
        makeSettings({ autoPublishAfterDeadline: false }),
      ),
    };
    const publication = { publishAuto: mockPublishAuto() };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoPublish: mockPeriodAutoPublish(),
    };

    const scheduler = createScheduler(prisma, admin, publication, audit);

    const result = await scheduler.runOnce(new Date("2026-05-12T12:00:00Z"));

    expect(result).toEqual({ published: false, reason: "disabled" });
    expect(prisma.report.findMany).not.toHaveBeenCalled();
    expect(publication.publishAuto).not.toHaveBeenCalled();
    expect(audit.periodAutoPublish).not.toHaveBeenCalled();
  });

  it("fire-when-eligible: draft past deadline+grace → publishAuto + emits audit with missingSectionsCount", async () => {
    const prisma = {
      report: {
        findMany: mockReportFindMany().mockResolvedValue([
          { id: "rep-1", deadline: overdueDeadline },
        ]),
      },
      reportSection: { count: mockReportSectionCount().mockResolvedValue(2) },
    };
    const admin = {
      getSettings: mockGetSettings().mockResolvedValue(makeSettings()),
    };
    const publication = {
      publishAuto: mockPublishAuto().mockResolvedValue({
        published: true,
        wasAlreadyPublished: false,
        report: { sections: [{ status: "draft" }, { status: "draft" }] },
      }),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoPublish: mockPeriodAutoPublish(),
    };

    const scheduler = createScheduler(prisma, admin, publication, audit);

    const result = await scheduler.runOnce(new Date("2026-05-12T12:00:00Z"));

    expect(result).toEqual({
      published: true,
      periodIds: ["rep-1"],
      failures: [],
    });
    expect(publication.publishAuto).toHaveBeenCalledWith(
      "rep-1",
      new Date("2026-05-12T12:00:00Z"),
      overdueDeadline,
    );
    expect(prisma.report.findMany).toHaveBeenCalledWith({
      where: {
        status: "draft",
        archived: false,
        periodState: "open",
        periodStatus: "open",
        deadline: { lt: new Date("2026-05-12T10:00:00.000Z") },
      },
      orderBy: { deadline: "asc" },
      select: { id: true, deadline: true },
    });
    expect(audit.periodAutoPublish).toHaveBeenCalledWith({
      periodId: "rep-1",
      missingSectionsCount: 2,
      from: "open",
      to: "published",
    });
  });

  it.each([0, 2])(
    "keeps committed success and audits %s drafts without a post-commit read",
    async (drafts) => {
      const count = mockReportSectionCount().mockRejectedValue(
        new Error("post-commit read unavailable"),
      );
      const prisma = {
        report: {
          findMany: mockReportFindMany().mockResolvedValue([
            { id: "committed", deadline: overdueDeadline },
          ]),
        },
        reportSection: { count },
      };
      const admin = {
        getSettings: mockGetSettings().mockResolvedValue(makeSettings()),
      };
      const publication = {
        publishAuto: mockPublishAuto().mockResolvedValue({
          published: true,
          wasAlreadyPublished: false,
          report: {
            sections: [
              ...Array.from({ length: drafts }, () => ({
                status: "draft" as const,
              })),
              { status: "submitted" },
            ],
          },
        }),
      };
      const audit = {
        ...createNullAuditLogger(),
        periodAutoPublish: mockPeriodAutoPublish(),
      };

      expect(
        await createScheduler(prisma, admin, publication, audit).runOnce(
          new Date("2026-05-12T12:00:00Z"),
        ),
      ).toEqual({ published: true, periodIds: ["committed"], failures: [] });
      expect(audit.periodAutoPublish).toHaveBeenCalledWith({
        periodId: "committed",
        missingSectionsCount: drafts,
        from: "open",
        to: "published",
      });
      expect(count).not.toHaveBeenCalled();
    },
  );

  it("idempotent: no eligible drafts → no-op, no publishAuto, no audit", async () => {
    const prisma = {
      report: { findMany: mockReportFindMany().mockResolvedValue([]) },
      reportSection: { count: mockReportSectionCount() },
    };
    const admin = {
      getSettings: mockGetSettings().mockResolvedValue(makeSettings()),
    };
    const publication = { publishAuto: mockPublishAuto() };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoPublish: mockPeriodAutoPublish(),
    };

    const scheduler = createScheduler(prisma, admin, publication, audit);

    const result = await scheduler.runOnce(new Date("2026-05-12T12:00:00Z"));

    expect(result).toEqual({ published: true, periodIds: [], failures: [] });
    expect(publication.publishAuto).not.toHaveBeenCalled();
    expect(audit.periodAutoPublish).not.toHaveBeenCalled();
  });

  it("single-period failure does not abort the tick (one bad report ≠ blocked queue)", async () => {
    silenceNestLogger();
    const prisma = {
      report: {
        findMany: mockReportFindMany().mockResolvedValue([
          { id: "rep-bad", deadline: overdueDeadline },
          { id: "rep-good", deadline: overdueDeadline },
        ]),
      },
      reportSection: { count: mockReportSectionCount().mockResolvedValue(0) },
    };
    const admin = {
      getSettings: mockGetSettings().mockResolvedValue(makeSettings()),
    };
    const publication = {
      publishAuto: mockPublishAuto()
        .mockImplementationOnce(() => {
          return Promise.reject(new Error("db transient"));
        })
        .mockImplementationOnce(() =>
          Promise.resolve({
            published: true,
            wasAlreadyPublished: false,
            report: { sections: [] },
          }),
        ),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoPublish: mockPeriodAutoPublish(),
    };

    const scheduler = createScheduler(prisma, admin, publication, audit);

    const result = await scheduler.runOnce(new Date("2026-05-12T12:00:00Z"));

    expect(result).toEqual({
      published: true,
      periodIds: ["rep-good"],
      failures: [{ periodId: "rep-bad", error: "db transient" }],
    });
    expect(audit.periodAutoPublish).toHaveBeenCalledTimes(1);
    expect(audit.periodAutoPublish).toHaveBeenCalledWith({
      periodId: "rep-good",
      missingSectionsCount: 0,
      from: "open",
      to: "published",
    });
  });

  // period-dual-state: an admin-archived draft (archive leaves status="draft")
  // must never be a candidate. Asserts on the findMany CALL, not just its
  // result, so it cannot pass vacuously on an empty mock return.
  it("excludes archived periods: candidate query carries archived:false", async () => {
    const prisma = {
      report: { findMany: mockReportFindMany().mockResolvedValue([]) },
      reportSection: { count: mockReportSectionCount() },
    };
    const admin = {
      getSettings: mockGetSettings().mockResolvedValue(makeSettings()),
    };
    const publication = { publishAuto: mockPublishAuto() };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoPublish: mockPeriodAutoPublish(),
    };

    const scheduler = createScheduler(prisma, admin, publication, audit);

    await scheduler.runOnce(new Date("2026-05-12T12:00:00Z"));

    expect(prisma.report.findMany.mock.calls).toMatchObject([
      [{ where: { status: "draft", archived: false } }],
    ]);
    expect(publication.publishAuto).not.toHaveBeenCalled();
  });

  // A skipped auto-publish (period archived between selection and the write →
  // CAS matched zero rows) fires NO success side-effects — no audit, no count,
  // no periodIds — and is not logged as an error (an expected no-op).
  it("skip outcome: {published:false} emits no audit, no count, no periodIds", async () => {
    const prisma = {
      report: {
        findMany: mockReportFindMany().mockResolvedValue([
          { id: "rep-skip", deadline: overdueDeadline },
        ]),
      },
      reportSection: { count: mockReportSectionCount() },
    };
    const admin = {
      getSettings: mockGetSettings().mockResolvedValue(makeSettings()),
    };
    const publication = {
      publishAuto: mockPublishAuto().mockResolvedValue({ published: false }),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoPublish: mockPeriodAutoPublish(),
    };

    const scheduler = createScheduler(prisma, admin, publication, audit);

    const result = await scheduler.runOnce(new Date("2026-05-12T12:00:00Z"));

    expect(publication.publishAuto).toHaveBeenCalledWith(
      "rep-skip",
      new Date("2026-05-12T12:00:00Z"),
      overdueDeadline,
    );
    expect(result).toEqual({ published: true, periodIds: [], failures: [] });
    expect(audit.periodAutoPublish).not.toHaveBeenCalled();
    expect(prisma.reportSection.count).not.toHaveBeenCalled();
  });

  // A skipped candidate is dropped while the published ones in the same tick are
  // kept: only the published id reaches periodIds and the audit log.
  it("mixed tick: skipped id excluded from periodIds, published id kept", async () => {
    const prisma = {
      report: {
        findMany: mockReportFindMany().mockResolvedValue([
          { id: "rep-skip", deadline: overdueDeadline },
          { id: "rep-ok", deadline: overdueDeadline },
        ]),
      },
      reportSection: { count: mockReportSectionCount().mockResolvedValue(1) },
    };
    const admin = {
      getSettings: mockGetSettings().mockResolvedValue(makeSettings()),
    };
    const publication = {
      publishAuto: mockPublishAuto()
        .mockResolvedValueOnce({ published: false })
        .mockResolvedValueOnce({
          published: true,
          wasAlreadyPublished: false,
          report: { sections: [{ status: "draft" }] },
        }),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoPublish: mockPeriodAutoPublish(),
    };

    const scheduler = createScheduler(prisma, admin, publication, audit);

    const result = await scheduler.runOnce(new Date("2026-05-12T12:00:00Z"));

    expect(result).toEqual({
      published: true,
      periodIds: ["rep-ok"],
      failures: [],
    });
    expect(audit.periodAutoPublish).toHaveBeenCalledTimes(1);
    expect(audit.periodAutoPublish).toHaveBeenCalledWith({
      periodId: "rep-ok",
      missingSectionsCount: 1,
      from: "open",
      to: "published",
    });
    expect(prisma.reportSection.count).not.toHaveBeenCalled();
  });

  // Manual publish between selection and publishAuto must not audit as auto.
  it("raced outcome: wasAlreadyPublished=true emits no audit, no log, no count, excluded from periodIds", async () => {
    const prisma = {
      report: {
        findMany: mockReportFindMany().mockResolvedValue([
          { id: "rep-race", deadline: overdueDeadline },
        ]),
      },
      reportSection: { count: mockReportSectionCount() },
    };
    const admin = {
      getSettings: mockGetSettings().mockResolvedValue(makeSettings()),
    };
    const publication = {
      publishAuto: mockPublishAuto().mockResolvedValue({
        published: true,
        wasAlreadyPublished: true,
        report: { sections: [] },
      }),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoPublish: mockPeriodAutoPublish(),
    };

    const scheduler = createScheduler(prisma, admin, publication, audit);

    const result = await scheduler.runOnce(new Date("2026-05-12T12:00:00Z"));

    expect(publication.publishAuto).toHaveBeenCalledWith(
      "rep-race",
      new Date("2026-05-12T12:00:00Z"),
      overdueDeadline,
    );
    expect(result).toEqual({ published: true, periodIds: [], failures: [] });
    expect(audit.periodAutoPublish).not.toHaveBeenCalled();
    expect(prisma.reportSection.count).not.toHaveBeenCalled();
  });

  // Mixed tick: a raced candidate must not suppress side-effects for a
  // genuine auto-publish elsewhere in the same batch.
  it("mixed tick: raced id excluded from periodIds, genuinely auto-published id still audited", async () => {
    const prisma = {
      report: {
        findMany: mockReportFindMany().mockResolvedValue([
          { id: "rep-race", deadline: overdueDeadline },
          { id: "rep-ok", deadline: overdueDeadline },
        ]),
      },
      reportSection: { count: mockReportSectionCount().mockResolvedValue(3) },
    };
    const admin = {
      getSettings: mockGetSettings().mockResolvedValue(makeSettings()),
    };
    const publication = {
      publishAuto: mockPublishAuto()
        .mockResolvedValueOnce({
          published: true,
          wasAlreadyPublished: true,
          report: { sections: [] },
        })
        .mockResolvedValueOnce({
          published: true,
          wasAlreadyPublished: false,
          report: {
            sections: [
              { status: "draft" },
              { status: "draft" },
              { status: "draft" },
            ],
          },
        }),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoPublish: mockPeriodAutoPublish(),
    };

    const scheduler = createScheduler(prisma, admin, publication, audit);

    const result = await scheduler.runOnce(new Date("2026-05-12T12:00:00Z"));

    expect(result).toEqual({
      published: true,
      periodIds: ["rep-ok"],
      failures: [],
    });
    expect(audit.periodAutoPublish).toHaveBeenCalledTimes(1);
    expect(audit.periodAutoPublish).toHaveBeenCalledWith({
      periodId: "rep-ok",
      missingSectionsCount: 3,
      from: "open",
      to: "published",
    });
    expect(prisma.reportSection.count).not.toHaveBeenCalled();
  });
});
