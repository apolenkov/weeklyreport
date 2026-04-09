import { describe, expect, it } from 'vitest';

import type { SubmissionDashboardRow, UserSession } from '@customreport/shared';

import { reviewRouter } from './review.router';
import {
  ReviewAccessError,
  ReviewService,
  type ReviewRepository,
} from './review.service';

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

const unsortedRows: SubmissionDashboardRow[] = [
  {
    leadId: '00000000-0000-4000-8000-000000000012',
    leadName: 'Lead 2',
    role: 'lead',
    projectNames: ['Project 2'],
    status: 'submitted',
    submittedAt: new Date('2026-04-09T10:00:00.000Z'),
  },
  {
    leadId: '00000000-0000-4000-8000-000000000013',
    leadName: 'Lead 3',
    role: 'lead',
    projectNames: ['Project 3'],
    status: 'draft',
    submittedAt: null,
  },
  {
    leadId: '00000000-0000-4000-8000-000000000011',
    leadName: 'Lead 1',
    role: 'lead',
    projectNames: ['Project 1'],
    status: 'draft',
    submittedAt: null,
  },
];

function createRepository(rows: SubmissionDashboardRow[]): ReviewRepository {
  return {
    async getSubmissionDashboard(activeReportId: string) {
      if (activeReportId !== reportId) {
        return [];
      }

      return structuredClone(rows);
    },
  };
}

describe('ReviewService', () => {
  it('returns one typed row per lead for the active report', async () => {
    const service = new ReviewService(createRepository(unsortedRows));

    await expect(service.getSubmissionDashboard(reportId)).resolves.toMatchObject([
      {
        leadName: 'Lead 1',
        projectNames: ['Project 1'],
        status: 'draft',
      },
      {
        leadName: 'Lead 3',
        projectNames: ['Project 3'],
        status: 'draft',
      },
      {
        leadName: 'Lead 2',
        projectNames: ['Project 2'],
        status: 'submitted',
      },
    ]);
  });

  it('sorts outstanding draft rows before submitted rows and then by lead name', async () => {
    const service = new ReviewService(createRepository(unsortedRows));

    const rows = await service.getSubmissionDashboard(reportId);

    expect(rows.map((row: SubmissionDashboardRow) => `${row.status}:${row.leadName}`)).toEqual([
      'draft:Lead 1',
      'draft:Lead 3',
      'submitted:Lead 2',
    ]);
  });

  it('rejects non-head access before returning dashboard data', async () => {
    const service = new ReviewService(createRepository(unsortedRows));

    await expect(
      reviewRouter.getSubmissionDashboard({
        reviewService: service,
        session: leadSession,
      }),
    ).rejects.toBeInstanceOf(ReviewAccessError);
  });
});

describe('reviewRouter', () => {
  it('allows a head session to read the active report dashboard', async () => {
    const service = new ReviewService(createRepository(unsortedRows));

    await expect(
      reviewRouter.getSubmissionDashboard({
        reviewService: service,
        session: headSession,
      }),
    ).resolves.toHaveLength(3);
  });
});
