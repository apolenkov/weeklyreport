import { describe, expect, it } from 'vitest';

import type { WeeklyReportReadModel } from '@customreport/shared';

import { mapWeeklyReport, formatWeekRange, __testing } from './weekly-report';
import { expectDefined } from '../../test/expect-defined.js';

const REPORT_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_A = '22222222-2222-4222-8222-222222222222';
const PROJECT_B = '33333333-3333-4333-8333-333333333333';
const SECTION_A = '44444444-4444-4444-8444-444444444444';
const SECTION_B = '55555555-5555-4555-8555-555555555555';
const AUTHOR_A = '66666666-6666-4666-8666-666666666666';
const AUTHOR_B = '77777777-7777-4777-8777-777777777777';

function baseReport(
  overrides: Partial<WeeklyReportReadModel> = {},
): WeeklyReportReadModel {
  return {
    reportId: REPORT_ID,
    periodStart: new Date('2026-04-14T00:00:00Z'),
    periodEnd: new Date('2026-04-20T00:00:00Z'),
    periodStatus: 'open',
    weekLabel: 'Week 16',
    submissionCount: 0,
    totalLeads: 0,
    portfolioOverview: [],
    leadSections: [],
    escalations: [],
    ...overrides,
  };
}

describe('formatWeekRange', () => {
  it('formats a same-month range with en-dash', () => {
    expect(
      formatWeekRange(
        new Date('2026-04-14T00:00:00Z'),
        new Date('2026-04-20T00:00:00Z'),
      ),
    ).toBe('Apr 14\u201320');
  });

  it('formats a cross-month range with en-dash and second month name', () => {
    expect(
      formatWeekRange(
        new Date('2026-04-28T00:00:00Z'),
        new Date('2026-05-04T00:00:00Z'),
      ),
    ).toBe('Apr 28\u2013May 4');
  });
});

describe('trafficToProductStatus', () => {
  const fn = __testing.trafficToProductStatus;
  it('green -> on-track, yellow -> at-risk, red -> blocked', () => {
    expect(fn('green')).toBe('on-track');
    expect(fn('yellow')).toBe('at-risk');
    expect(fn('red')).toBe('blocked');
  });

  it('null worstStatus collapses to on-track', () => {
    expect(fn(null)).toBe('on-track');
  });
});

describe('statusLabelFor', () => {
  const fn = __testing.statusLabelFor;
  it("joins lead names with ', ' and prefixes the status", () => {
    expect(fn('at-risk', ['Polenkov A.', 'Maria K.'])).toBe(
      'At Risk \u00b7 Polenkov A., Maria K.',
    );
  });
  it('falls back to "unassigned" when no leads', () => {
    expect(fn('on-track', [])).toBe('On Track \u00b7 unassigned');
  });
});

describe('mapWeeklyReport', () => {
  it('returns empty portfolio and products for an empty report', () => {
    const result = mapWeeklyReport(baseReport());
    expect(result.portfolio).toEqual([]);
    expect(result.products).toEqual([]);
    expect(result.period.weekLabel).toBe('Week 16');
    expect(result.submissionLabel).toBe('0/0 submitted');
  });

  it('surfaces reportId and periodStatus on the period object (Phase 22, plan 22-05)', () => {
    const result = mapWeeklyReport(baseReport({ periodStatus: 'open' }));
    expect(result.period.reportId).toBe(REPORT_ID);
    expect(result.period.periodStatus).toBe('open');
  });

  it('reflects published periodStatus on the period object', () => {
    const result = mapWeeklyReport(baseReport({ periodStatus: 'published' }));
    expect(result.period.periodStatus).toBe('published');
    expect(result.period.isCurrent).toBe(false);
  });

  it('reflects reopened periodStatus on the period object', () => {
    const result = mapWeeklyReport(baseReport({ periodStatus: 'reopened' }));
    expect(result.period.periodStatus).toBe('reopened');
    expect(result.period.isCurrent).toBe(true);
  });

  it('groups items by project across multiple lead sections', () => {
    const report = baseReport({
      submissionCount: 2,
      totalLeads: 2,
      portfolioOverview: [
        {
          productId: PROJECT_A,
          productName: 'CRM Platform',
          worstStatus: 'yellow',
          stageCount: 7,
          leadNames: ['Polenkov A.', 'Maria K.'],
        },
        {
          productId: PROJECT_B,
          productName: 'Mobile',
          worstStatus: 'green',
          stageCount: 7,
          leadNames: ['Igor V.'],
        },
      ],
      leadSections: [
        {
          reportSectionId: SECTION_A,
          reportId: REPORT_ID,
          authorId: AUTHOR_A,
          authorName: 'Polenkov A.',
          status: 'submitted',
          submittedAt: new Date('2026-04-19T18:00:00Z'),
          projects: [
            { projectId: PROJECT_A, projectName: 'CRM Platform', trafficLight: 'yellow' },
          ],
          items: [
            {
              id: 'i1',
              projectId: PROJECT_A,
              type: 'current',
              text: 'OAuth integration',
              tag: 'auth',
              workflowStatus: 'in_progress',
              carriedOver: false,
            },
            {
              id: 'i2',
              projectId: PROJECT_A,
              type: 'next',
              text: 'SSO portal',
              tag: 'sso',
              workflowStatus: 'in_progress',
              carriedOver: false,
            },
          ],
          risks: [
            {
              id: 'r1',
              projectId: PROJECT_A,
              risk: 'OAuth slow',
              impact: 'SSO slips',
              mitigation: 'Vendor escalation',
            },
          ],
          decisions: [],
          priorities: [],
        },
        {
          reportSectionId: SECTION_B,
          reportId: REPORT_ID,
          authorId: AUTHOR_B,
          authorName: 'Igor V.',
          status: 'submitted',
          submittedAt: new Date('2026-04-19T17:00:00Z'),
          projects: [
            { projectId: PROJECT_B, projectName: 'Mobile', trafficLight: 'green' },
          ],
          items: [
            {
              id: 'i3',
              projectId: PROJECT_B,
              type: 'current',
              text: 'Push notifications',
              tag: 'notif',
              workflowStatus: 'done',
              carriedOver: false,
            },
          ],
          risks: [],
          decisions: [],
          priorities: [],
        },
      ],
    });

    const result = mapWeeklyReport(report);

    expect(result.portfolio).toHaveLength(2);
    const crm = result.portfolio.find((p) => p.id === PROJECT_A);
    expect(crm?.status).toBe('at-risk');
    expect(crm?.leads).toBe('Polenkov A. \u00b7 Maria K.');
    expect(crm?.currentWeekCount).toBe(1);
    expect(crm?.nextWeekCount).toBe(1);
    expect(crm?.riskCount).toBe(1);

    const mobile = result.portfolio.find((p) => p.id === PROJECT_B);
    expect(mobile?.status).toBe('on-track');
    expect(mobile?.currentWeekCount).toBe(1);

    const crmReport = result.products.find((p) => p.id === PROJECT_A);
    expect(crmReport?.currentWeek).toHaveLength(1);
    expect(expectDefined(crmReport?.currentWeek[0]).text).toBe('OAuth integration');
    expect(expectDefined(crmReport?.currentWeek[0]).stageLead).toBe('Dev \u00b7 PA');
    expect(expectDefined(crmReport?.nextWeek[0]).stageLead).toBe('Planned');
    expect(crmReport?.risks).toHaveLength(1);
    expect(expectDefined(crmReport?.risks[0]).severity).toBe('at-risk');
    // Phase 31 (AI-03): sectionId threaded from the first lead section
    // whose projects[] contains the productId. Required for OnTrackIcon
    // mount in product-accordion.
    expect(crmReport?.sectionId).toBe(SECTION_A);
    const mobileReport = result.products.find((p) => p.id === PROJECT_B);
    expect(mobileReport?.sectionId).toBe(SECTION_B);
  });

  it('omits sectionId when no lead section authored content for a product (AI-03)', () => {
    const result = mapWeeklyReport(
      baseReport({
        portfolioOverview: [
          {
            productId: PROJECT_A,
            productName: 'Orphan',
            worstStatus: null,
            stageCount: 0,
            leadNames: [],
          },
        ],
        leadSections: [],
      }),
    );
    const orphan = result.products.find((p) => p.id === PROJECT_A);
    expect(orphan?.sectionId).toBeUndefined();
  });

  it('infers risk severity as blocked when project has any blocked item', () => {
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PROJECT_A,
          productName: 'CRM',
          worstStatus: 'red',
          stageCount: 7,
          leadNames: ['Polenkov A.'],
        },
      ],
      leadSections: [
        {
          reportSectionId: SECTION_A,
          reportId: REPORT_ID,
          authorId: AUTHOR_A,
          authorName: 'Polenkov A.',
          status: 'draft',
          submittedAt: null,
          projects: [
            { projectId: PROJECT_A, projectName: 'CRM', trafficLight: 'red' },
          ],
          items: [
            {
              id: 'i1',
              projectId: PROJECT_A,
              type: 'current',
              text: 'ETL fix',
              tag: 'etl',
              workflowStatus: 'blocked',
              carriedOver: false,
            },
          ],
          risks: [
            {
              id: 'r1',
              projectId: PROJECT_A,
              risk: 'OOM in ETL',
              impact: 'Blocks release',
              mitigation: 'Vendor patch',
            },
          ],
          decisions: [],
          priorities: [],
        },
      ],
    });

    const result = mapWeeklyReport(report);
    const crmReport = result.products.find((p) => p.id === PROJECT_A);
    expect(expectDefined(crmReport?.risks[0]).severity).toBe('blocked');
  });

  it('attaches needsAttention from matching escalation', () => {
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PROJECT_A,
          productName: 'CRM',
          worstStatus: 'yellow',
          stageCount: 7,
          leadNames: ['Polenkov A.'],
        },
      ],
      escalations: [
        {
          type: 'at_risk',
          productName: 'CRM',
          stageName: 'Dev',
          leadName: 'Polenkov A.',
          description: 'OAuth slow due to vendor.',
        },
      ],
    });

    const result = mapWeeklyReport(report);
    const crmReport = result.products.find((p) => p.id === PROJECT_A);
    expect(crmReport?.needsAttention).toBe('OAuth slow due to vendor.');
    expect(crmReport?.needsAttentionSeverity).toBe('at-risk');
  });

  it("attaches a section's decisions and priorities to the section's first project", () => {
    const report = baseReport({
      portfolioOverview: [
        {
          productId: PROJECT_A,
          productName: 'CRM',
          worstStatus: 'green',
          stageCount: 7,
          leadNames: ['Polenkov A.'],
        },
      ],
      leadSections: [
        {
          reportSectionId: SECTION_A,
          reportId: REPORT_ID,
          authorId: AUTHOR_A,
          authorName: 'Polenkov A.',
          status: 'submitted',
          submittedAt: new Date('2026-04-19T18:00:00Z'),
          projects: [
            { projectId: PROJECT_A, projectName: 'CRM', trafficLight: 'green' },
          ],
          items: [],
          risks: [],
          decisions: [
            { id: 'd1', text: 'Approve Redis cluster', owner: 'Head', impact: 'Caching' },
          ],
          priorities: [{ id: 'p1', rank: 1, text: 'Ship OAuth' }],
        },
      ],
    });

    const result = mapWeeklyReport(report);
    const crmReport = result.products.find((p) => p.id === PROJECT_A);
    expect(crmReport?.decisions).toHaveLength(1);
    expect(expectDefined(crmReport?.decisions[0]).text).toBe('Approve Redis cluster');
    expect(crmReport?.priorities).toHaveLength(1);
    expect(expectDefined(crmReport?.priorities[0]).text).toBe('Ship OAuth');
  });

  it('preserves period info from the API', () => {
    const result = mapWeeklyReport(baseReport({ periodStatus: 'published' }));
    expect(result.period.id).toBe(REPORT_ID);
    expect(result.period.dateRange).toBe('Apr 14\u201320');
    expect(result.period.isCurrent).toBe(false); // published periods aren't "current"
  });
});
