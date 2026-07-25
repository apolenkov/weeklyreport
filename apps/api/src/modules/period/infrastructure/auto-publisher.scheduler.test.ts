import type { AppSettings } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../../lib/audit-logger.js";
import { silenceNestLogger } from "../../../test-utils/silence-logs";
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

const asAny = <T>(x: unknown): T => x as T;

describe("AutoPublisherScheduler", () => {
  it("skip-when-disabled: autoPublishAfterDeadline=false → no DB scan", async () => {
    const prisma = {
      report: { findMany: vi.fn() },
      reportSection: { count: vi.fn() },
    };
    const admin = {
      getSettings: vi
        .fn()
        .mockResolvedValue(makeSettings({ autoPublishAfterDeadline: false })),
    };
    const publication = { publishAuto: vi.fn() };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoPublish: vi.fn(),
    };

    const scheduler = new AutoPublisherScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(publication),
      asAny(audit),
    );

    const result = await scheduler.runOnce(new Date("2026-05-12T12:00:00Z"));

    expect(result).toEqual({ published: false, reason: "disabled" });
    expect(prisma.report.findMany).not.toHaveBeenCalled();
    expect(publication.publishAuto).not.toHaveBeenCalled();
    expect(audit.periodAutoPublish).not.toHaveBeenCalled();
  });

  it("fire-when-eligible: draft past deadline+grace → publishAuto + emits audit with missingSectionsCount", async () => {
    const prisma = {
      report: {
        findMany: vi.fn().mockResolvedValue([{ id: "rep-1" }]),
      },
      reportSection: { count: vi.fn().mockResolvedValue(2) },
    };
    const admin = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
    };
    const publication = {
      publishAuto: vi.fn().mockResolvedValue({
        published: true,
        wasAlreadyPublished: false,
        report: {},
      }),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoPublish: vi.fn(),
    };

    const scheduler = new AutoPublisherScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(publication),
      asAny(audit),
    );

    const result = await scheduler.runOnce(new Date("2026-05-12T12:00:00Z"));

    expect(result).toEqual({ published: true, periodIds: ["rep-1"] });
    expect(publication.publishAuto).toHaveBeenCalledWith("rep-1");
    expect(audit.periodAutoPublish).toHaveBeenCalledWith({
      periodId: "rep-1",
      missingSectionsCount: 2,
      from: "open",
      to: "published",
    });
  });

  it("idempotent: no eligible drafts → no-op, no publishAuto, no audit", async () => {
    const prisma = {
      report: { findMany: vi.fn().mockResolvedValue([]) },
      reportSection: { count: vi.fn() },
    };
    const admin = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
    };
    const publication = { publishAuto: vi.fn() };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoPublish: vi.fn(),
    };

    const scheduler = new AutoPublisherScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(publication),
      asAny(audit),
    );

    const result = await scheduler.runOnce(new Date("2026-05-12T12:00:00Z"));

    expect(result).toEqual({ published: true, periodIds: [] });
    expect(publication.publishAuto).not.toHaveBeenCalled();
    expect(audit.periodAutoPublish).not.toHaveBeenCalled();
  });

  it("single-period failure does not abort the tick (one bad report ≠ blocked queue)", async () => {
    silenceNestLogger();
    const prisma = {
      report: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "rep-bad" }, { id: "rep-good" }]),
      },
      reportSection: { count: vi.fn().mockResolvedValue(0) },
    };
    const admin = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
    };
    const publication = {
      publishAuto: vi
        .fn()
        // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async publishAuto contract (throws synchronously to simulate error)
        .mockImplementationOnce(async () => {
          throw new Error("db transient");
        })
        // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async publishAuto contract (no awaitable work in the stub)
        .mockImplementationOnce(async () => ({
          published: true,
          wasAlreadyPublished: false,
          report: {},
        })),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoPublish: vi.fn(),
    };

    const scheduler = new AutoPublisherScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(publication),
      asAny(audit),
    );

    const result = await scheduler.runOnce(new Date("2026-05-12T12:00:00Z"));

    expect(result).toEqual({ published: true, periodIds: ["rep-good"] });
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
      report: { findMany: vi.fn().mockResolvedValue([]) },
      reportSection: { count: vi.fn() },
    };
    const admin = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
    };
    const publication = { publishAuto: vi.fn() };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoPublish: vi.fn(),
    };

    const scheduler = new AutoPublisherScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(publication),
      asAny(audit),
    );

    await scheduler.runOnce(new Date("2026-05-12T12:00:00Z"));

    expect(prisma.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() returns any; vitest asymmetric matcher has no precise type
        where: expect.objectContaining({ status: "draft", archived: false }),
      }),
    );
    expect(publication.publishAuto).not.toHaveBeenCalled();
  });

  // period-dual-state: a skipped auto-publish (the period was archived between
  // selection and the write → compare-and-set matched zero rows) must fire NO
  // success side-effects — no audit, no missing-section count, id not in
  // periodIds — and must NOT be logged as an error (a skip is an expected no-op).
  it("skip outcome: {published:false} emits no audit, no count, no periodIds", async () => {
    const prisma = {
      report: { findMany: vi.fn().mockResolvedValue([{ id: "rep-skip" }]) },
      reportSection: { count: vi.fn() },
    };
    const admin = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
    };
    const publication = {
      publishAuto: vi.fn().mockResolvedValue({ published: false }),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoPublish: vi.fn(),
    };

    const scheduler = new AutoPublisherScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(publication),
      asAny(audit),
    );

    const result = await scheduler.runOnce(new Date("2026-05-12T12:00:00Z"));

    expect(publication.publishAuto).toHaveBeenCalledWith("rep-skip");
    expect(result).toEqual({ published: true, periodIds: [] });
    expect(audit.periodAutoPublish).not.toHaveBeenCalled();
    expect(prisma.reportSection.count).not.toHaveBeenCalled();
  });

  // A skipped candidate is dropped while the published ones in the same tick are
  // kept: only the published id reaches periodIds and the audit log.
  it("mixed tick: skipped id excluded from periodIds, published id kept", async () => {
    const prisma = {
      report: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "rep-skip" }, { id: "rep-ok" }]),
      },
      reportSection: { count: vi.fn().mockResolvedValue(1) },
    };
    const admin = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
    };
    const publication = {
      publishAuto: vi
        .fn()
        .mockResolvedValueOnce({ published: false })
        .mockResolvedValueOnce({
          published: true,
          wasAlreadyPublished: false,
          report: {},
        }),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoPublish: vi.fn(),
    };

    const scheduler = new AutoPublisherScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(publication),
      asAny(audit),
    );

    const result = await scheduler.runOnce(new Date("2026-05-12T12:00:00Z"));

    expect(result).toEqual({ published: true, periodIds: ["rep-ok"] });
    expect(audit.periodAutoPublish).toHaveBeenCalledTimes(1);
    expect(audit.periodAutoPublish).toHaveBeenCalledWith({
      periodId: "rep-ok",
      missingSectionsCount: 1,
      from: "open",
      to: "published",
    });
    expect(prisma.reportSection.count).toHaveBeenCalledTimes(1);
  });

  // Manual publish between selection and publishAuto must not audit as auto.
  it("raced outcome: wasAlreadyPublished=true emits no audit, no log, no count, excluded from periodIds", async () => {
    const prisma = {
      report: { findMany: vi.fn().mockResolvedValue([{ id: "rep-race" }]) },
      reportSection: { count: vi.fn() },
    };
    const admin = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
    };
    const publication = {
      publishAuto: vi.fn().mockResolvedValue({
        published: true,
        wasAlreadyPublished: true,
        report: {},
      }),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoPublish: vi.fn(),
    };

    const scheduler = new AutoPublisherScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(publication),
      asAny(audit),
    );

    const result = await scheduler.runOnce(new Date("2026-05-12T12:00:00Z"));

    expect(publication.publishAuto).toHaveBeenCalledWith("rep-race");
    expect(result).toEqual({ published: true, periodIds: [] });
    expect(audit.periodAutoPublish).not.toHaveBeenCalled();
    expect(prisma.reportSection.count).not.toHaveBeenCalled();
  });

  // Mixed tick: a raced candidate must not suppress side-effects for a
  // genuine auto-publish elsewhere in the same batch.
  it("mixed tick: raced id excluded from periodIds, genuinely auto-published id still audited", async () => {
    const prisma = {
      report: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "rep-race" }, { id: "rep-ok" }]),
      },
      reportSection: { count: vi.fn().mockResolvedValue(3) },
    };
    const admin = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
    };
    const publication = {
      publishAuto: vi
        .fn()
        .mockResolvedValueOnce({
          published: true,
          wasAlreadyPublished: true,
          report: {},
        })
        .mockResolvedValueOnce({
          published: true,
          wasAlreadyPublished: false,
          report: {},
        }),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoPublish: vi.fn(),
    };

    const scheduler = new AutoPublisherScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(publication),
      asAny(audit),
    );

    const result = await scheduler.runOnce(new Date("2026-05-12T12:00:00Z"));

    expect(result).toEqual({ published: true, periodIds: ["rep-ok"] });
    expect(audit.periodAutoPublish).toHaveBeenCalledTimes(1);
    expect(audit.periodAutoPublish).toHaveBeenCalledWith({
      periodId: "rep-ok",
      missingSectionsCount: 3,
      from: "open",
      to: "published",
    });
    expect(prisma.reportSection.count).toHaveBeenCalledTimes(1);
  });
});
