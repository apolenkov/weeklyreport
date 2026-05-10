import { describe, expect, it } from 'vitest';

import type { AssembledReport, DraftSavePayload, UserSession } from '@customreport/shared';

import { publicationRouter } from './publication.router';
import {
  PublicationAccessError,
  PublicationService,
  type PublicationRepository,
} from './publication.service';

const reportId = '22222222-2222-4222-8222-222222222222';

const headSession: UserSession = {
  userId: '00000000-0000-4000-8000-000000000001',
  email: 'head@customreport.local',
  name: 'Department Head',
  role: 'head',
  activeReportId: reportId,
  activeReportSectionId: null,
};

const leadSession: UserSession = {
  userId: '00000000-0000-4000-8000-000000000002',
  email: 'lead1@customreport.local',
  name: 'Lead 1',
  role: 'lead',
  activeReportId: reportId,
  activeReportSectionId: '33333333-3333-4333-8333-333333333333',
};

const assembledReport: AssembledReport = {
  reportId,
  periodStart: new Date('2026-04-06T00:00:00.000Z'),
  periodEnd: new Date('2026-04-12T23:59:59.000Z'),
  deadline: new Date('2026-04-10T15:00:00.000Z'),
  status: 'draft',
  publishedAt: null,
  publishedById: null,
  publishedByName: null,
  portfolioOverview: {
    status: 'red',
    totals: {
      green: 1,
      yellow: 1,
      red: 1,
    },
  },
  sections: [
    {
      reportSectionId: '11111111-1111-4111-8111-111111111111',
      reportId,
      authorId: '33333333-3333-4333-8333-333333333333',
      authorName: 'Lead 1',
      status: 'submitted',
      submittedAt: new Date('2026-04-09T10:00:00.000Z'),
      projects: [
        {
          projectId: '44444444-4444-4444-8444-444444444444',
          projectName: 'Project 1',
          trafficLight: 'green',
        },
      ],
      items: [],
      risks: [],
      decisions: [],
      priorities: [
        { rank: 1, text: 'Priority 1' },
        { rank: 2, text: 'Priority 2' },
        { rank: 3, text: 'Priority 3' },
      ],
    },
    {
      reportSectionId: '22222222-2222-4222-8222-222222222223',
      reportId,
      authorId: '33333333-3333-4333-8333-333333333334',
      authorName: 'Lead 2',
      status: 'draft',
      submittedAt: null,
      projects: [
        {
          projectId: '44444444-4444-4444-8444-444444444445',
          projectName: 'Project 2',
          trafficLight: 'yellow',
        },
      ],
      items: [],
      risks: [],
      decisions: [],
      priorities: [
        { rank: 1, text: 'Priority 1' },
        { rank: 2, text: 'Priority 2' },
        { rank: 3, text: 'Priority 3' },
      ],
    },
    {
      reportSectionId: '22222222-2222-4222-8222-222222222224',
      reportId,
      authorId: '33333333-3333-4333-8333-333333333335',
      authorName: 'Lead 3',
      status: 'draft',
      submittedAt: null,
      projects: [
        {
          projectId: '44444444-4444-4444-8444-444444444446',
          projectName: 'Project 3',
          trafficLight: 'red',
        },
      ],
      items: [],
      risks: [],
      decisions: [],
      priorities: [
        { rank: 1, text: 'Priority 1' },
        { rank: 2, text: 'Priority 2' },
        { rank: 3, text: 'Priority 3' },
      ],
    },
  ],
};

function createRepository(report: AssembledReport): PublicationRepository {
  let currentReport = structuredClone(report);

  return {
    async getAssembledReport(activeReportId: string) {
      if (activeReportId !== reportId) {
        return null;
      }

      return structuredClone(currentReport);
    },
    async saveAssembledReport(nextReport: AssembledReport) {
      currentReport = structuredClone(nextReport);

      return structuredClone(currentReport);
    },
  };
}

const reviewUpdate: DraftSavePayload = {
  reportSectionId: '11111111-1111-4111-8111-111111111111',
  status: 'draft',
  projectStatuses: [
    {
      projectId: '44444444-4444-4444-8444-444444444444',
      status: 'yellow',
    },
  ],
  items: [
    {
      projectId: '44444444-4444-4444-8444-444444444444',
      type: 'current',
      text: 'Reviewed current week update',
      tag: 'feature',
      workflowStatus: 'in_progress',
    },
  ],
  risks: [],
  decisions: [],
  priorities: [
    { rank: 1, text: 'Priority 1' },
    { rank: 2, text: 'Priority 2' },
    { rank: 3, text: 'Priority 3' },
  ],
};

describe('PublicationService', () => {
  it('returns the assembled report for the active report', async () => {
    const service = new PublicationService(createRepository(assembledReport));

    await expect(service.getAssembledReport(reportId)).resolves.toMatchObject({
      reportId,
      status: 'draft',
    });
  });

  it('keeps portfolio overview aggregation deterministic', async () => {
    const service = new PublicationService(createRepository(assembledReport));
    const report = await service.getAssembledReport(reportId);

    expect(report.portfolioOverview).toEqual({
      status: 'red',
      totals: {
        green: 1,
        yellow: 1,
        red: 1,
      },
    });
  });

  it('allows section review updates before publish', async () => {
    const service = new PublicationService(createRepository(assembledReport));
    const updatedReport = await service.updateSectionForReview(reportId, reviewUpdate);

    expect(updatedReport.sections[0]?.projects[0]?.trafficLight).toBe('yellow');
    expect(updatedReport.sections[0]?.items[0]?.text).toBe('Reviewed current week update');
  });

  it('publishes once and rejects further review changes', async () => {
    const service = new PublicationService(createRepository(assembledReport));

    const published = await service.publishReport(reportId, headSession);

    expect(published.status).toBe('published');
    expect(published.publishedById).toBe(headSession.userId);
    expect(published.publishedAt).toBeInstanceOf(Date);

    await expect(
      service.updateSectionForReview(reportId, reviewUpdate),
    ).rejects.toBeInstanceOf(PublicationAccessError);
  });

  it('rejects non-head access before returning assembled report data', async () => {
    const service = new PublicationService(createRepository(assembledReport));

    await expect(
      publicationRouter.getAssembledReport({
        publicationService: service,
        session: leadSession,
      }),
    ).rejects.toBeInstanceOf(PublicationAccessError);
  });

  // UFB-049 / Phase 50-B: scheduler-driven auto-publish bypasses session
  // attribution. publishedById stays null and publishedByName='system' so
  // the head dashboard can show a "auto-published" badge by comparing.
  it('publishAuto stamps system attribution (publishedById=null)', async () => {
    const service = new PublicationService(createRepository(assembledReport));

    const published = await service.publishAuto(reportId);

    expect(published.status).toBe('published');
    expect(published.publishedById).toBeNull();
    expect(published.publishedByName).toBe('system');
    expect(published.publishedAt).toBeInstanceOf(Date);
  });

  it('publishAuto is idempotent on already-published reports (no throw, returns current)', async () => {
    const service = new PublicationService(createRepository(assembledReport));

    const first = await service.publishAuto(reportId);
    const second = await service.publishAuto(reportId);

    expect(first.status).toBe('published');
    expect(second.status).toBe('published');
    // publishedAt should be the same instant — the second call must not
    // re-stamp a new Date(); idempotent means "no write".
    expect(second.publishedAt).toEqual(first.publishedAt);
  });
});

describe('publicationRouter', () => {
  it('allows a head session to read the assembled report', async () => {
    const service = new PublicationService(createRepository(assembledReport));

    await expect(
      publicationRouter.getAssembledReport({
        publicationService: service,
        session: headSession,
      }),
    ).resolves.toMatchObject({
      reportId,
      portfolioOverview: { status: 'red' },
    });
  });

  it('publishes for a head session and blocks a second publish attempt', async () => {
    const service = new PublicationService(createRepository(assembledReport));

    const published = await publicationRouter.publishReport({
      publicationService: service,
      session: headSession,
    });

    expect(published.status).toBe('published');

    await expect(
      publicationRouter.publishReport({
        publicationService: service,
        session: headSession,
      }),
    ).rejects.toBeInstanceOf(PublicationAccessError);
  });
});
