import { describe, expect, it, vi } from 'vitest';

import type { UserSession } from '@customreport/shared';

import {
  PeriodAccessError,
  PeriodService,
  type PeriodRepository,
} from './period.service';

/* ------------------------------------------------------------------ */
/*  Fixed test UUIDs                                                   */
/* ------------------------------------------------------------------ */

const reportId = '22222222-2222-4222-8222-222222222222';
const otherReportId = '33333333-3333-4333-8333-333333333333';

const headSession: UserSession = {
  userId: '00000000-0000-4000-8000-000000000001',
  email: 'head@customreport.local',
  name: 'Department Head',
  role: 'head',
  activeReportId: reportId,
  activeReportSectionId: null,
};

/* ------------------------------------------------------------------ */
/*  Mock repository with spies                                         */
/* ------------------------------------------------------------------ */

function createSpyRepository(
  reports: Map<
    string,
    {
      id: string;
      status: string;
      periodStatus: string;
      publishedAt: Date | null;
    }
  >,
): PeriodRepository & {
  publishPeriod: ReturnType<typeof vi.fn>;
  reopenPeriod: ReturnType<typeof vi.fn>;
} {
  const publishFn = vi.fn(async (id: string) => {
    const r = reports.get(id);
    if (r) {
      r.periodStatus = 'published';
      r.publishedAt = new Date();
    }
  });

  const reopenFn = vi.fn(async (id: string) => {
    const r = reports.get(id);
    if (r) {
      r.periodStatus = 'reopened';
    }
  });

  return {
    async getReportById(id: string) {
      const r = reports.get(id);
      return r ? structuredClone(r) : null;
    },
    publishPeriod: publishFn,
    reopenPeriod: reopenFn,
  };
}

/* ------------------------------------------------------------------ */
/*  publishPeriod — service-level unit tests                           */
/* ------------------------------------------------------------------ */

describe('PeriodService — publishPeriod (unit)', () => {
  it('calls repository.publishPeriod with correct args', async () => {
    const reports = new Map([
      [reportId, { id: reportId, status: 'draft', periodStatus: 'open', publishedAt: null }],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(repo);

    await service.publishPeriod(reportId, headSession);

    expect(repo.publishPeriod).toHaveBeenCalledOnce();
    expect(repo.publishPeriod).toHaveBeenCalledWith(reportId, headSession.userId);
  });

  it('returns the reportId in the success result', async () => {
    const reports = new Map([
      [reportId, { id: reportId, status: 'draft', periodStatus: 'open', publishedAt: null }],
    ]);
    const service = new PeriodService(createSpyRepository(reports));

    const result = await service.publishPeriod(reportId, headSession);

    expect(result.reportId).toBe(reportId);
    expect(result.success).toBe(true);
  });

  it('throws plain Error (not PeriodAccessError) when report is missing', async () => {
    const service = new PeriodService(createSpyRepository(new Map()));

    await expect(
      service.publishPeriod(reportId, headSession),
    ).rejects.toThrow(Error);

    // Verify it's NOT a PeriodAccessError
    await expect(
      service.publishPeriod(reportId, headSession),
    ).rejects.not.toBeInstanceOf(PeriodAccessError);
  });

  it('does not call repository when period is already published', async () => {
    const reports = new Map([
      [reportId, { id: reportId, status: 'published', periodStatus: 'published', publishedAt: new Date() }],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(repo);

    await expect(service.publishPeriod(reportId, headSession)).rejects.toThrow();
    expect(repo.publishPeriod).not.toHaveBeenCalled();
  });

  it('publish-then-reopen-then-publish cycle works', async () => {
    const reports = new Map([
      [reportId, { id: reportId, status: 'draft', periodStatus: 'open', publishedAt: null }],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(repo);

    // 1. Publish
    await service.publishPeriod(reportId, headSession);
    expect(repo.publishPeriod).toHaveBeenCalledOnce();

    // 2. Reopen
    await service.reopenPeriod(reportId);
    expect(repo.reopenPeriod).toHaveBeenCalledOnce();

    // 3. Re-publish (reopened -> published is allowed)
    await service.publishPeriod(reportId, headSession);
    expect(repo.publishPeriod).toHaveBeenCalledTimes(2);
  });

  it('different reports are independent', async () => {
    const reports = new Map([
      [reportId, { id: reportId, status: 'draft', periodStatus: 'open', publishedAt: null }],
      [otherReportId, { id: otherReportId, status: 'published', periodStatus: 'published', publishedAt: new Date() }],
    ]);
    const service = new PeriodService(createSpyRepository(reports));

    // First report can be published
    await expect(service.publishPeriod(reportId, headSession)).resolves.toEqual({
      success: true,
      reportId,
    });

    // Second is already published — should fail
    await expect(
      service.publishPeriod(otherReportId, headSession),
    ).rejects.toBeInstanceOf(PeriodAccessError);
  });
});

/* ------------------------------------------------------------------ */
/*  reopenPeriod — service-level unit tests                            */
/* ------------------------------------------------------------------ */

describe('PeriodService — reopenPeriod (unit)', () => {
  it('calls repository.reopenPeriod with correct reportId', async () => {
    const reports = new Map([
      [reportId, { id: reportId, status: 'published', periodStatus: 'published', publishedAt: new Date() }],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(repo);

    await service.reopenPeriod(reportId);

    expect(repo.reopenPeriod).toHaveBeenCalledOnce();
    expect(repo.reopenPeriod).toHaveBeenCalledWith(reportId);
  });

  it('does not call repository when period is not published', async () => {
    const reports = new Map([
      [reportId, { id: reportId, status: 'draft', periodStatus: 'open', publishedAt: null }],
    ]);
    const repo = createSpyRepository(reports);
    const service = new PeriodService(repo);

    await expect(service.reopenPeriod(reportId)).rejects.toThrow();
    expect(repo.reopenPeriod).not.toHaveBeenCalled();
  });

  it('double reopen of a reopened period fails', async () => {
    const reports = new Map([
      [reportId, { id: reportId, status: 'published', periodStatus: 'published', publishedAt: new Date() }],
    ]);
    const service = new PeriodService(createSpyRepository(reports));

    // First reopen works
    await service.reopenPeriod(reportId);

    // Second reopen fails (now status is 'reopened', not 'published')
    await expect(service.reopenPeriod(reportId)).rejects.toBeInstanceOf(PeriodAccessError);
  });
});
