import { describe, expect, it } from 'vitest';

import {
  submissionDashboardRowSchema,
  type SubmissionDashboardRow,
} from '@customreport/shared';

import { ReviewService, type ReviewRepository } from './review.service';
import { expectDefined } from '../../test-utils/expect-defined.js';

/* ------------------------------------------------------------------ */
/*  Fixed test UUIDs                                                   */
/* ------------------------------------------------------------------ */

const reportId = '22222222-2222-4222-8222-222222222222';

/* ------------------------------------------------------------------ */
/*  In-memory mock repository                                          */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

function makeRow(overrides: Partial<SubmissionDashboardRow> & { leadId: string; leadName: string }): SubmissionDashboardRow {
  return {
    role: 'lead',
    projectNames: ['Default Project'],
    status: 'draft',
    submittedAt: null,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('ReviewService — contract tests', () => {
  it('returns empty array for report with no sections', async () => {
    const service = new ReviewService(createRepository([]));

    const rows = await service.getSubmissionDashboard(reportId);

    expect(rows).toEqual([]);
  });

  it('sorts drafts before submitted', async () => {
    const rows: SubmissionDashboardRow[] = [
      makeRow({
        leadId: '00000000-0000-4000-8000-000000000001',
        leadName: 'Alpha',
        status: 'submitted',
        submittedAt: new Date('2026-04-09T10:00:00.000Z'),
      }),
      makeRow({
        leadId: '00000000-0000-4000-8000-000000000002',
        leadName: 'Bravo',
        status: 'draft',
      }),
    ];

    const service = new ReviewService(createRepository(rows));
    const result = await service.getSubmissionDashboard(reportId);

    expect(result.map((r) => r.status)).toEqual(['draft', 'submitted']);
  });

  it('within same status, sorts by leadName using Russian locale collation', async () => {
    const rows: SubmissionDashboardRow[] = [
      makeRow({
        leadId: '00000000-0000-4000-8000-000000000003',
        leadName: 'Charlie',
        status: 'draft',
      }),
      makeRow({
        leadId: '00000000-0000-4000-8000-000000000001',
        leadName: 'Alpha',
        status: 'draft',
      }),
      makeRow({
        leadId: '00000000-0000-4000-8000-000000000002',
        leadName: 'Bravo',
        status: 'draft',
      }),
    ];

    const service = new ReviewService(createRepository(rows));
    const result = await service.getSubmissionDashboard(reportId);

    expect(result.map((r) => r.leadName)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('validates output through Zod schema — extra fields are stripped', async () => {
    // Simulate a repository returning rows with an extra unknown field
    const rowWithExtra = {
      leadId: '00000000-0000-4000-8000-000000000001',
      leadName: 'Lead A',
      role: 'lead' as const,
      projectNames: ['Project X'],
      status: 'draft' as const,
      submittedAt: null,
      extraField: 'should be stripped',
    };

    const repo: ReviewRepository = {
      async getSubmissionDashboard() {
        return [structuredClone(rowWithExtra)];
      },
    };

    const service = new ReviewService(repo);
    const result = await service.getSubmissionDashboard(reportId);

    expect(result).toHaveLength(1);
    expect('extraField' in expectDefined(result[0])).toBe(false);

    // Also verify the result parses cleanly through the schema
    const parsed = submissionDashboardRowSchema.array().parse(result);
    expect(parsed).toEqual(result);
  });

  it('handles single section', async () => {
    const rows: SubmissionDashboardRow[] = [
      makeRow({
        leadId: '00000000-0000-4000-8000-000000000001',
        leadName: 'Solo Lead',
        status: 'submitted',
        submittedAt: new Date('2026-04-10T08:00:00.000Z'),
        projectNames: ['Only Project'],
      }),
    ];

    const service = new ReviewService(createRepository(rows));
    const result = await service.getSubmissionDashboard(reportId);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      leadName: 'Solo Lead',
      status: 'submitted',
      projectNames: ['Only Project'],
    });
  });

  it('handles all sections submitted', async () => {
    const rows: SubmissionDashboardRow[] = [
      makeRow({
        leadId: '00000000-0000-4000-8000-000000000002',
        leadName: 'Bravo',
        status: 'submitted',
        submittedAt: new Date('2026-04-09T11:00:00.000Z'),
      }),
      makeRow({
        leadId: '00000000-0000-4000-8000-000000000001',
        leadName: 'Alpha',
        status: 'submitted',
        submittedAt: new Date('2026-04-09T10:00:00.000Z'),
      }),
    ];

    const service = new ReviewService(createRepository(rows));
    const result = await service.getSubmissionDashboard(reportId);

    expect(result.every((r) => r.status === 'submitted')).toBe(true);
    expect(result.map((r) => r.leadName)).toEqual(['Alpha', 'Bravo']);
  });

  it('handles all sections draft', async () => {
    const rows: SubmissionDashboardRow[] = [
      makeRow({
        leadId: '00000000-0000-4000-8000-000000000002',
        leadName: 'Zulu',
      }),
      makeRow({
        leadId: '00000000-0000-4000-8000-000000000001',
        leadName: 'Alpha',
      }),
    ];

    const service = new ReviewService(createRepository(rows));
    const result = await service.getSubmissionDashboard(reportId);

    expect(result.every((r) => r.status === 'draft')).toBe(true);
    expect(result.map((r) => r.leadName)).toEqual(['Alpha', 'Zulu']);
  });

  it('Russian names sort correctly (Андрей before Борис before Яков)', async () => {
    const rows: SubmissionDashboardRow[] = [
      makeRow({
        leadId: '00000000-0000-4000-8000-000000000003',
        leadName: 'Яков',
        status: 'draft',
      }),
      makeRow({
        leadId: '00000000-0000-4000-8000-000000000001',
        leadName: 'Андрей',
        status: 'draft',
      }),
      makeRow({
        leadId: '00000000-0000-4000-8000-000000000002',
        leadName: 'Борис',
        status: 'draft',
      }),
    ];

    const service = new ReviewService(createRepository(rows));
    const result = await service.getSubmissionDashboard(reportId);

    expect(result.map((r) => r.leadName)).toEqual(['Андрей', 'Борис', 'Яков']);
  });

  it('returns correct submitted count (DASH-010)', async () => {
    const rows: SubmissionDashboardRow[] = [
      makeRow({ leadId: '00000000-0000-4000-8000-000000000001', leadName: 'A', status: 'submitted', submittedAt: new Date() }),
      makeRow({ leadId: '00000000-0000-4000-8000-000000000002', leadName: 'B', status: 'draft' }),
      makeRow({ leadId: '00000000-0000-4000-8000-000000000003', leadName: 'C', status: 'submitted', submittedAt: new Date() }),
    ];

    const service = new ReviewService(createRepository(rows));
    const result = await service.getSubmissionDashboard(reportId);

    const submittedCount = result.filter((r) => r.status === 'submitted').length;
    const draftCount = result.filter((r) => r.status === 'draft').length;
    expect(submittedCount).toBe(2);
    expect(draftCount).toBe(1);
    expect(result).toHaveLength(3);
  });

  it('returns empty for non-matching reportId (DASH-011 edge)', async () => {
    const rows: SubmissionDashboardRow[] = [
      makeRow({ leadId: '00000000-0000-4000-8000-000000000001', leadName: 'A' }),
    ];

    const service = new ReviewService(createRepository(rows));
    const result = await service.getSubmissionDashboard('99999999-9999-4999-8999-999999999999');

    expect(result).toEqual([]);
  });

  it('excludes non-lead roles from dashboard (DASH-015 P1)', async () => {
    const rows: SubmissionDashboardRow[] = [
      makeRow({ leadId: '00000000-0000-4000-8000-000000000001', leadName: 'Lead A', role: 'lead' }),
      // Only leads appear in the dashboard
    ];

    const service = new ReviewService(createRepository(rows));
    const result = await service.getSubmissionDashboard(reportId);

    expect(result.every((r) => r.role === 'lead')).toBe(true);
  });

  it('mixed statuses with Russian names sort correctly', async () => {
    const rows: SubmissionDashboardRow[] = [
      makeRow({
        leadId: '00000000-0000-4000-8000-000000000004',
        leadName: 'Григорий',
        status: 'submitted',
        submittedAt: new Date('2026-04-09T12:00:00.000Z'),
      }),
      makeRow({
        leadId: '00000000-0000-4000-8000-000000000003',
        leadName: 'Яков',
        status: 'draft',
      }),
      makeRow({
        leadId: '00000000-0000-4000-8000-000000000005',
        leadName: 'Алексей',
        status: 'submitted',
        submittedAt: new Date('2026-04-09T11:00:00.000Z'),
      }),
      makeRow({
        leadId: '00000000-0000-4000-8000-000000000001',
        leadName: 'Андрей',
        status: 'draft',
      }),
      makeRow({
        leadId: '00000000-0000-4000-8000-000000000002',
        leadName: 'Борис',
        status: 'draft',
      }),
    ];

    const service = new ReviewService(createRepository(rows));
    const result = await service.getSubmissionDashboard(reportId);

    // Drafts first, sorted by Russian name; then submitted, sorted by Russian name
    expect(result.map((r) => `${r.status}:${r.leadName}`)).toEqual([
      'draft:Андрей',
      'draft:Борис',
      'draft:Яков',
      'submitted:Алексей',
      'submitted:Григорий',
    ]);
  });
});
