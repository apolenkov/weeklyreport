import { describe, expect, it, vi } from "vitest";

import { customreportReportsSubmittedTotal } from "../../../infrastructure/metrics/metrics.registry.js";
import {
  adminSession,
  archivedReportId,
  createSpyRepository,
  getCounterValue,
  headSession,
  noGatingReopenPolicy,
  noopInvalidate,
  openReport,
  otherReportId,
  publishedReport,
  reopenedReport,
  reportId,
  type SpyReport,
} from "./__tests__/period-service-harness.js";
import {
  PeriodNotFoundError,
  type PeriodRepository,
  PeriodScopeError,
  PeriodService,
} from "./period.service";

describe("PeriodService — publish target scope", () => {
  it("head publishes the active editable period", async () => {
    const repo = createSpyRepository(
      new Map<string, SpyReport>([[reportId, openReport(reportId)]]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(service.publishPeriod(reportId, headSession)).resolves.toEqual(
      {
        success: true,
        reportId,
      },
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(repo.publishPeriod).toHaveBeenCalledWith(
      reportId,
      headSession.userId,
    );
  });

  it("rejects a head publishing a stale/foreign editable id (not the active period)", async () => {
    // reportId is the resolved active editable id (inserted first); otherReportId
    // is an older editable period the head must not be able to target.
    const repo = createSpyRepository(
      new Map<string, SpyReport>([
        [reportId, openReport(reportId)],
        [otherReportId, openReport(otherReportId)],
      ]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.publishPeriod(otherReportId, headSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(repo.publishPeriod).not.toHaveBeenCalled();
  });

  it("lets an admin publish an arbitrary non-archived editable id", async () => {
    const repo = createSpyRepository(
      new Map<string, SpyReport>([
        [reportId, openReport(reportId)],
        [otherReportId, openReport(otherReportId)],
      ]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    // reportId is the resolved active id; an admin still publishes the OTHER one.
    await expect(
      service.publishPeriod(otherReportId, adminSession),
    ).resolves.toEqual({ success: true, reportId: otherReportId });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(repo.publishPeriod).toHaveBeenCalledWith(
      otherReportId,
      adminSession.userId,
    );
  });

  it("rejects an archived target for a head", async () => {
    const repo = createSpyRepository(
      new Map<string, SpyReport>([
        [archivedReportId, openReport(archivedReportId, true)],
      ]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.publishPeriod(archivedReportId, headSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(repo.publishPeriod).not.toHaveBeenCalled();
  });

  it("rejects an archived target for an admin", async () => {
    const repo = createSpyRepository(
      new Map<string, SpyReport>([
        [archivedReportId, openReport(archivedReportId, true)],
      ]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.publishPeriod(archivedReportId, adminSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(repo.publishPeriod).not.toHaveBeenCalled();
  });

  it("maps a missing report to PeriodNotFoundError, not a bare Error", async () => {
    const service = new PeriodService(
      createSpyRepository(new Map()),
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.publishPeriod(reportId, headSession),
    ).rejects.toBeInstanceOf(PeriodNotFoundError);
  });

  it("rejects a head publish when no active editable period exists (no write, no telemetry)", async () => {
    // Fail-closed: the target clears the not-found/archived/already-published
    // gates but the server resolves NO active editable period (e.g. a future
    // scheduled target excluded by periodStart<=now). The mock decouples
    // getReportById from the resolver to model that state directly.
    const target = openReport(reportId);
    const publishPeriod = vi.fn(() =>
      Promise.resolve({ transitioned: true as const }),
    );
    const repo: PeriodRepository = {
      getReportById: () => Promise.resolve({ ...target, archived: false }),
      getCurrentEditableId: () => Promise.resolve(null),
      getLatestPublishedNonArchivedId: () => Promise.resolve(null),
      getReopenedNonArchivedId: () => Promise.resolve(null),
      publishPeriod,
      reopenPeriod: vi.fn(() => Promise.resolve()),
      listSectionIds: () => Promise.resolve([]),
    };
    const before = await getCounterValue(customreportReportsSubmittedTotal, {
      state: "published",
    });
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.publishPeriod(reportId, headSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);
    expect(publishPeriod).not.toHaveBeenCalled();
    expect(
      await getCounterValue(customreportReportsSubmittedTotal, {
        state: "published",
      }),
    ).toBe(before);
  });
});

describe("PeriodService — reopen target scope", () => {
  it("head reopens the latest published non-archived period", async () => {
    const repo = createSpyRepository(
      new Map<string, SpyReport>([[reportId, publishedReport(reportId)]]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(service.reopenPeriod(reportId, headSession)).resolves.toEqual({
      success: true,
      reportId,
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(repo.reopenPeriod).toHaveBeenCalledWith(reportId);
  });

  it("rejects a head reopening a stale published id (not the latest)", async () => {
    const repo = createSpyRepository(
      new Map<string, SpyReport>([
        [reportId, publishedReport(reportId)],
        [otherReportId, publishedReport(otherReportId)],
      ]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    // reportId is the resolved latest published id; otherReportId is stale.
    await expect(
      service.reopenPeriod(otherReportId, headSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(repo.reopenPeriod).not.toHaveBeenCalled();
  });

  it("lets an admin reopen an arbitrary non-archived published id", async () => {
    const repo = createSpyRepository(
      new Map<string, SpyReport>([
        [reportId, publishedReport(reportId)],
        [otherReportId, publishedReport(otherReportId)],
      ]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.reopenPeriod(otherReportId, adminSession),
    ).resolves.toEqual({ success: true, reportId: otherReportId });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(repo.reopenPeriod).toHaveBeenCalledWith(otherReportId);
  });

  it("rejects an archived published target for a head", async () => {
    const repo = createSpyRepository(
      new Map<string, SpyReport>([
        [archivedReportId, publishedReport(archivedReportId, true)],
      ]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.reopenPeriod(archivedReportId, headSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(repo.reopenPeriod).not.toHaveBeenCalled();
  });

  it("rejects an archived published target for an admin", async () => {
    const repo = createSpyRepository(
      new Map<string, SpyReport>([
        [archivedReportId, publishedReport(archivedReportId, true)],
      ]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.reopenPeriod(archivedReportId, adminSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(repo.reopenPeriod).not.toHaveBeenCalled();
  });

  it("resolves the latest published NON-archived id when the newest published row is archived", async () => {
    // The newest published row (reportId) is archived; an older published row
    // (otherReportId) is non-archived. The reopen resolver must skip the
    // archived newest and return the older non-archived id, and a head reopening
    // THAT id succeeds — the archived guard does not block the older
    // non-archived period.
    const repo = createSpyRepository(
      new Map<string, SpyReport>([
        [reportId, publishedReport(reportId, true)],
        [otherReportId, publishedReport(otherReportId, false)],
      ]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.reopenPeriod(otherReportId, headSession),
    ).resolves.toEqual({ success: true, reportId: otherReportId });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(repo.reopenPeriod).toHaveBeenCalledWith(otherReportId);

    // The archived newest is itself rejected by the archived guard.
    await expect(
      service.reopenPeriod(reportId, headSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);
  });

  it("maps a missing report to PeriodNotFoundError", async () => {
    const service = new PeriodService(
      createSpyRepository(new Map()),
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.reopenPeriod(reportId, headSession),
    ).rejects.toBeInstanceOf(PeriodNotFoundError);
  });

  it("rejects a head reopen when no latest published target exists (no write, no cache invalidation)", async () => {
    // Fail-closed: the target clears the not-found/archived/published gates but
    // the server resolves NO latest published non-archived target. Decoupled mock.
    const target = publishedReport(reportId);
    const reopenPeriod = vi.fn(() => Promise.resolve());
    const invalidate = vi.fn(() => Promise.resolve(undefined));
    const repo: PeriodRepository = {
      getReportById: () => Promise.resolve({ ...target, archived: false }),
      getCurrentEditableId: () => Promise.resolve(null),
      getLatestPublishedNonArchivedId: () => Promise.resolve(null),
      getReopenedNonArchivedId: () => Promise.resolve(null),
      publishPeriod: vi.fn(() =>
        Promise.resolve({ transitioned: true as const }),
      ),
      reopenPeriod,
      listSectionIds: () => Promise.resolve([]),
    };
    const service = new PeriodService(repo, invalidate, noGatingReopenPolicy);

    await expect(
      service.reopenPeriod(reportId, headSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);
    expect(reopenPeriod).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe("PeriodService — reopen → republish & single-active-reopen guard", () => {
  it("lets a head republish a reopened period even when a newer open period is the current editable", async () => {
    // Steady state: week N (reportId) is published; week N+1 (otherReportId) is
    // open and — inserted first — is what getCurrentEditableId resolves. A head
    // reopens N and must be able to republish it; a strict equality check against
    // the current editable (N+1) would brick this legitimate reopen→republish flow.
    const reports = new Map<string, SpyReport>([
      [otherReportId, openReport(otherReportId)],
      [reportId, publishedReport(reportId)],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await service.reopenPeriod(reportId, headSession);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(repo.reopenPeriod).toHaveBeenCalledWith(reportId);

    await expect(service.publishPeriod(reportId, headSession)).resolves.toEqual(
      {
        success: true,
        reportId,
      },
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(repo.publishPeriod).toHaveBeenCalledWith(
      reportId,
      headSession.userId,
    );
  });

  it("rejects a head reopening a second period while another is already reopened (walk-back guard)", async () => {
    // otherReportId is already reopened; reportId is the latest published
    // non-archived target. Allowing this reopen would let a head walk back
    // through history and republish each older period — forbidden for a non-admin.
    const reports = new Map<string, SpyReport>([
      [otherReportId, reopenedReport(otherReportId)],
      [reportId, publishedReport(reportId)],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.reopenPeriod(reportId, headSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(repo.reopenPeriod).not.toHaveBeenCalled();
  });

  it("lets an admin reopen a second period while another is reopened (recovery path)", async () => {
    const reports = new Map<string, SpyReport>([
      [otherReportId, reopenedReport(otherReportId)],
      [reportId, publishedReport(reportId)],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(service.reopenPeriod(reportId, adminSession)).resolves.toEqual(
      { success: true, reportId },
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(repo.reopenPeriod).toHaveBeenCalledWith(reportId);
  });
});

describe("PeriodService — publish reopened-target scope", () => {
  it("lets a head publish the single active reopened period (its own)", async () => {
    const repo = createSpyRepository(
      new Map<string, SpyReport>([[reportId, reopenedReport(reportId)]]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(service.publishPeriod(reportId, headSession)).resolves.toEqual(
      { success: true, reportId },
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(repo.publishPeriod).toHaveBeenCalledWith(
      reportId,
      headSession.userId,
    );
  });

  it("rejects a head publishing a reopened target that is not the single active reopened period", async () => {
    // reportId (inserted first) is the single active reopened period
    // getReopenedNonArchivedId resolves; otherReportId is a SECOND reopened row
    // — only reachable via an admin reopen of a historical period. A head must
    // not be able to publish it (the closed bypass).
    const repo = createSpyRepository(
      new Map<string, SpyReport>([
        [reportId, reopenedReport(reportId)],
        [otherReportId, reopenedReport(otherReportId)],
      ]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.publishPeriod(otherReportId, headSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(repo.publishPeriod).not.toHaveBeenCalled();
  });

  it("lets an admin publish any reopened target (reopen→fix→republish preserved)", async () => {
    const repo = createSpyRepository(
      new Map<string, SpyReport>([
        [reportId, reopenedReport(reportId)],
        [otherReportId, reopenedReport(otherReportId)],
      ]),
    );
    const service = new PeriodService(
      repo,
      noopInvalidate,
      noGatingReopenPolicy,
    );

    await expect(
      service.publishPeriod(otherReportId, adminSession),
    ).resolves.toEqual({ success: true, reportId: otherReportId });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(repo.publishPeriod).toHaveBeenCalledWith(
      otherReportId,
      adminSession.userId,
    );
  });
});

describe("PeriodService — archive-in-window publish outcome", () => {
  // The pre-write read sees a non-archived open period (it raced ahead of the
  // archive's commit), so the service clears its archived gate and calls the
  // repo; the guarded compare-and-set then reports the archive that landed in
  // the window. The mock returns the repo outcome directly to model that state.
  function repoWithOutcome(
    publish: ReturnType<typeof vi.fn>,
  ): PeriodRepository {
    return {
      getReportById: () =>
        Promise.resolve({
          id: reportId,
          status: "draft",
          periodStatus: "open",
          publishedAt: null,
          archived: false,
        }),
      getCurrentEditableId: () => Promise.resolve(reportId),
      getLatestPublishedNonArchivedId: () => Promise.resolve(null),
      getReopenedNonArchivedId: () => Promise.resolve(null),
      publishPeriod: publish as PeriodRepository["publishPeriod"],
      reopenPeriod: () => Promise.resolve(),
      listSectionIds: () => Promise.resolve(["s1"]),
    };
  }

  it("throws PeriodScopeError and emits no telemetry when the period was archived in the window", async () => {
    const ingestion = vi.fn(() => Promise.resolve());
    const publish = vi.fn(() =>
      Promise.resolve({ transitioned: false as const, reason: "archived" }),
    );
    const service = new PeriodService(
      repoWithOutcome(publish),
      noopInvalidate,
      noGatingReopenPolicy,
      ingestion,
    );

    const before = await getCounterValue(customreportReportsSubmittedTotal, {
      state: "published",
    });

    await expect(
      service.publishPeriod(reportId, headSession),
    ).rejects.toBeInstanceOf(PeriodScopeError);

    expect(ingestion).not.toHaveBeenCalled();
    expect(
      await getCounterValue(customreportReportsSubmittedTotal, {
        state: "published",
      }),
    ).toBe(before);
  });

  it("returns idempotent success with no side-effects when a concurrent publish won (raced)", async () => {
    const ingestion = vi.fn(() => Promise.resolve());
    const publish = vi.fn(() =>
      Promise.resolve({ transitioned: false as const, reason: "raced" }),
    );
    const service = new PeriodService(
      repoWithOutcome(publish),
      noopInvalidate,
      noGatingReopenPolicy,
      ingestion,
    );

    await expect(service.publishPeriod(reportId, headSession)).resolves.toEqual(
      { success: true, reportId },
    );
    expect(ingestion).not.toHaveBeenCalled();
  });
});
