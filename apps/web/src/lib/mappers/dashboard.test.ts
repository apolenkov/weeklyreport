import { describe, expect, it } from 'vitest';

import {
  weeklyReportReadModelSchema,
  archiveReportSummarySchema,
  submissionDashboardRowSchema,
  type SubmissionDashboardRow,
  type WeeklyReportReadModel,
  type ArchiveReportSummary,
  type PaginatedResult,
} from '@customreport/shared';

import { mapDashboardData, formatRelativeDeadline } from './dashboard';

// v4-shape UUIDs (4 in position 13, 8/9/a/b in position 17).
const REPORT_ID = '11111111-1111-4111-8111-aaaaaaaaaaaa';
const SECTION_A = '11111111-1111-4111-8111-bbbbbbbbbbb1';
const SECTION_B = '11111111-1111-4111-8111-bbbbbbbbbbb2';
const LEAD_A = '11111111-1111-4111-8111-cc0000000001';
const LEAD_B = '11111111-1111-4111-8111-cc0000000002';
const LEAD_C = '11111111-1111-4111-8111-cc0000000003';
const PROJECT_A = '11111111-1111-4111-8111-dd0000000001';
const PROJECT_B = '11111111-1111-4111-8111-dd0000000002';
const ITEM_A = '11111111-1111-4111-8111-aa0000000001';
const ITEM_B = '11111111-1111-4111-8111-aa0000000002';
const DECISION_A = '11111111-1111-4111-8111-ee0000000001';
const ARCHIVE_A = '11111111-1111-4111-8111-ff0000000001';
const ARCHIVE_B = '11111111-1111-4111-8111-ff0000000002';

function makeReview(): SubmissionDashboardRow[] {
  return [
    submissionDashboardRowSchema.parse({
      leadId: LEAD_A,
      leadName: 'Alice Lead',
      role: 'lead',
      projectNames: ['CRM Portal'],
      status: 'submitted',
      submittedAt: '2026-04-20T10:00:00.000Z',
    }),
    submissionDashboardRowSchema.parse({
      leadId: LEAD_B,
      leadName: 'Bob Lead',
      role: 'lead',
      projectNames: ['Analytics'],
      status: 'draft',
      submittedAt: null,
    }),
    submissionDashboardRowSchema.parse({
      leadId: LEAD_C,
      leadName: 'Cara Lead',
      role: 'lead',
      projectNames: ['Mobile'],
      status: 'draft',
      submittedAt: null,
    }),
  ];
}

function makeWeeklyReport(overrides: Partial<WeeklyReportReadModel> = {}): WeeklyReportReadModel {
  return weeklyReportReadModelSchema.parse({
    reportId: REPORT_ID,
    periodStart: '2026-04-13T00:00:00.000Z',
    periodEnd: '2026-04-19T23:59:59.000Z',
    periodStatus: 'open',
    weekLabel: 'Week 16',
    departmentName: 'Core Development',
    submissionCount: overrides.submissionCount ?? 4,
    totalLeads: overrides.totalLeads ?? 6,
    portfolioOverview: overrides.portfolioOverview ?? [
      {
        productId: PROJECT_A,
        productName: 'CRM Portal',
        worstStatus: 'green',
        stageCount: 3,
        leadNames: ['Alice Lead'],
      },
      {
        productId: PROJECT_B,
        productName: 'Analytics',
        worstStatus: 'red',
        stageCount: 2,
        leadNames: ['Bob Lead'],
      },
    ],
    leadSections: overrides.leadSections ?? [
      {
        reportSectionId: SECTION_A,
        reportId: REPORT_ID,
        authorId: LEAD_A,
        authorName: 'Alice Lead',
        status: 'submitted',
        submittedAt: '2026-04-20T10:00:00.000Z',
        projects: [],
        items: [
          {
            id: ITEM_A,
            projectId: PROJECT_A,
            type: 'current',
            text: 'Done thing',
            tag: 'Dev',
            workflowStatus: 'done',
            carriedOver: false,
            completed: true,
          },
        ],
        risks: [],
        decisions: [
          {
            id: DECISION_A,
            text: 'Approve hire',
            owner: 'Head',
            deadline: null,
            impact: 'Team capacity',
            resolvedAt: null,
          },
        ],
        priorities: [],
      },
      {
        reportSectionId: SECTION_B,
        reportId: REPORT_ID,
        authorId: LEAD_B,
        authorName: 'Bob Lead',
        status: 'draft',
        submittedAt: null,
        projects: [],
        items: [
          {
            id: ITEM_B,
            projectId: PROJECT_B,
            type: 'current',
            text: 'In flight thing',
            tag: 'Dev',
            workflowStatus: 'in_progress',
            carriedOver: false,
            completed: false,
          },
        ],
        risks: [],
        decisions: [],
        priorities: [],
      },
      // Cara has NO section -> 'pending'.
    ],
    escalations: overrides.escalations ?? [
      {
        type: 'blocked',
        productName: 'Analytics',
        stageName: 'Development',
        leadName: 'Bob Lead',
        description: 'ETL memory leak',
      },
      {
        type: 'at_risk',
        productName: 'CRM Portal',
        stageName: 'Development',
        leadName: 'Alice Lead',
        description: 'OAuth2 partner delay',
      },
      {
        type: 'unresolved_risk',
        productName: 'CRM Portal',
        stageName: null,
        leadName: 'Alice Lead',
        description: 'Carried over risk',
      },
    ],
    ...overrides,
  });
}

function makeArchive(): PaginatedResult<ArchiveReportSummary> {
  return {
    items: [
      archiveReportSummarySchema.parse({
        reportId: ARCHIVE_A,
        periodStart: '2026-04-06T00:00:00.000Z',
        periodEnd: '2026-04-12T23:59:59.000Z',
        publishedAt: '2026-04-13T00:00:00.000Z',
        publishedByName: 'Head Person',
        portfolioStatus: 'green',
      }),
      archiveReportSummarySchema.parse({
        reportId: ARCHIVE_B,
        periodStart: '2026-03-30T00:00:00.000Z',
        periodEnd: '2026-04-05T23:59:59.000Z',
        publishedAt: '2026-04-06T00:00:00.000Z',
        publishedByName: 'Head Person',
        portfolioStatus: 'yellow',
      }),
    ],
    nextCursor: null,
  };
}

describe('formatRelativeDeadline', () => {
  it('returns "Past" when the deadline has passed', () => {
    const now = new Date('2026-04-25T10:00:00.000Z');
    const deadline = new Date('2026-04-24T10:00:00.000Z');
    expect(formatRelativeDeadline(deadline, now)).toBe('Past');
  });

  it('returns "Nh" when less than 1 day remains', () => {
    const now = new Date('2026-04-25T10:00:00.000Z');
    const deadline = new Date('2026-04-25T15:00:00.000Z');
    expect(formatRelativeDeadline(deadline, now)).toBe('5h');
  });

  it('returns "Nd Mh" when more than a day remains', () => {
    const now = new Date('2026-04-23T10:00:00.000Z');
    const deadline = new Date('2026-04-25T15:00:00.000Z');
    expect(formatRelativeDeadline(deadline, now)).toBe('2d 5h');
  });
});

describe('mapDashboardData', () => {
  it('produces kpi.submitted/total from weeklyReport counts (4/6 case)', () => {
    const result = mapDashboardData({
      review: makeReview(),
      archive: makeArchive(),
      weeklyReport: makeWeeklyReport({ submissionCount: 4, totalLeads: 6 }),
      now: new Date('2026-04-17T13:00:00.000Z'),
    });
    expect(result.kpi.submitted).toBe(4);
    expect(result.kpi.total).toBe(6);
  });

  it('computes deadlineLabel relative to weeklyReport.periodEnd', () => {
    // periodEnd = 2026-04-19T23:59:59Z, now = 2026-04-17T19:00:00Z -> ~52h -> 2d 4h
    const result = mapDashboardData({
      review: makeReview(),
      archive: makeArchive(),
      weeklyReport: makeWeeklyReport(),
      now: new Date('2026-04-17T19:00:00.000Z'),
    });
    expect(result.kpi.deadlineLabel).toMatch(/^\d+d \d+h$|^\d+h$/);
  });

  it('counts blocked and at-risk escalations into KPI', () => {
    const result = mapDashboardData({
      review: makeReview(),
      archive: makeArchive(),
      weeklyReport: makeWeeklyReport(),
      now: new Date('2026-04-17T10:00:00.000Z'),
    });
    expect(result.kpi.blockedCount).toBe(1);
    // 1 at_risk + 1 unresolved_risk = 2
    expect(result.kpi.atRiskCount).toBe(2);
  });

  it('sums decisions across all lead sections', () => {
    const result = mapDashboardData({
      review: makeReview(),
      archive: makeArchive(),
      weeklyReport: makeWeeklyReport(),
      now: new Date('2026-04-17T10:00:00.000Z'),
    });
    expect(result.kpi.decisionCount).toBe(1);
  });

  it("derives lead status: 'submitted' / 'draft' / 'pending' (no section)", () => {
    const result = mapDashboardData({
      review: makeReview(),
      archive: makeArchive(),
      weeklyReport: makeWeeklyReport(),
      now: new Date('2026-04-17T10:00:00.000Z'),
    });
    const alice = result.leads.find((l) => l.id === LEAD_A);
    const bob = result.leads.find((l) => l.id === LEAD_B);
    const cara = result.leads.find((l) => l.id === LEAD_C);
    expect(alice?.status).toBe('submitted');
    expect(bob?.status).toBe('draft');
    expect(cara?.status).toBe('pending');
  });

  it('produces pendingLeads as a string[] of pending lead names', () => {
    const result = mapDashboardData({
      review: makeReview(),
      archive: makeArchive(),
      weeklyReport: makeWeeklyReport(),
      now: new Date('2026-04-17T10:00:00.000Z'),
    });
    expect(result.pendingLeads).toEqual(['Cara Lead']);
  });

  it('derives blockedAtRisk severity correctly from escalation type', () => {
    const result = mapDashboardData({
      review: makeReview(),
      archive: makeArchive(),
      weeklyReport: makeWeeklyReport(),
      now: new Date('2026-04-17T10:00:00.000Z'),
    });
    expect(result.blockedAtRisk).toHaveLength(3);
    const blocked = result.blockedAtRisk.filter((b) => b.severity === 'blocked');
    const atRisk = result.blockedAtRisk.filter((b) => b.severity === 'at-risk');
    expect(blocked).toHaveLength(1);
    expect(atRisk).toHaveLength(2);
  });

  it('maps archive items with synthesized weekLabel and dateRange', () => {
    const result = mapDashboardData({
      review: makeReview(),
      archive: makeArchive(),
      weeklyReport: makeWeeklyReport(),
      now: new Date('2026-04-17T10:00:00.000Z'),
    });
    expect(result.archive).toHaveLength(2);
    expect(result.archive[0]?.weekLabel).toMatch(/^Week \d+$/);
    expect(result.archive[0]?.dateRange).toMatch(/[A-Z][a-z]{2} \d+\u2013[A-Z][a-z]{2} \d+/);
  });

  it('flags isCurrentUser when currentUserId matches a lead row', () => {
    const result = mapDashboardData({
      review: makeReview(),
      archive: makeArchive(),
      weeklyReport: makeWeeklyReport(),
      now: new Date('2026-04-17T10:00:00.000Z'),
      currentUserId: LEAD_A,
    });
    const alice = result.leads.find((l) => l.id === LEAD_A);
    const bob = result.leads.find((l) => l.id === LEAD_B);
    expect(alice?.isCurrentUser).toBe(true);
    expect(bob?.isCurrentUser).toBe(false);
  });
});
