import { describe, expect, it } from 'vitest';

import type {
  ReportSectionReadModel,
  MyHistoryEntry,
  VersionSnapshot,
} from '@customreport/shared';

import {
  mapLeadFormData,
  mapLeadProducts,
  mapLeadItems,
  mapLeadRisks,
  mapLeadDecisions,
  mapLeadPriorities,
  mapLeadPeriods,
  mapLeadVersions,
} from './lead-form';
import { expectDefined } from '../../test/expect-defined.js';

const SECTION_ID = '11111111-1111-4111-8111-111111111111';
const REPORT_ID = '22222222-2222-4222-8222-222222222222';
const AUTHOR_ID = '33333333-3333-4333-8333-333333333333';
const PROJECT_A = '44444444-4444-4444-8444-444444444444';
const PROJECT_B = '55555555-5555-4555-8555-555555555555';

function baseSection(
  overrides: Partial<ReportSectionReadModel> = {},
): ReportSectionReadModel {
  return {
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: 'Polenkov A.',
    status: 'draft',
    submittedAt: null,
    projects: [],
    items: [],
    risks: [],
    decisions: [],
    priorities: [],
    ...overrides,
  };
}

describe('mapLeadProducts', () => {
  it('maps a green project to overallStatus on-track and synthesizes a 7-stage grid', () => {
    const section = baseSection({
      projects: [
        { projectId: PROJECT_A, projectName: 'CRM Platform', trafficLight: 'green' },
      ],
    });

    const products = mapLeadProducts(section);

    expect(products).toHaveLength(1);
    expect(expectDefined(products[0]).id).toBe(PROJECT_A);
    expect(expectDefined(products[0]).name).toBe('CRM Platform');
    expect(expectDefined(products[0]).overallStatus).toBe('on-track');
    expect(expectDefined(products[0]).stages).toHaveLength(7);
    const devStage = expectDefined(products[0]).stages.find((s) => s.stageName === 'Dev');
    expect(devStage?.ownership).toBe('mine');
    expect(devStage?.assignee).toBe('Polenkov A.');
    expect(devStage?.status).toBe('on-track');
  });

  it('maps a null trafficLight project to overallStatus empty', () => {
    const section = baseSection({
      projects: [
        { projectId: PROJECT_A, projectName: 'Stale', trafficLight: null },
      ],
    });

    const [product] = mapLeadProducts(section);
    expect(product?.overallStatus).toBe('empty');
  });

  it('returns empty array when the section has no projects', () => {
    expect(mapLeadProducts(baseSection())).toEqual([]);
  });
});

describe('mapLeadItems', () => {
  it("returns 'in-progress' for a current-type item with workflowStatus='in_progress'", () => {
    const section = baseSection({
      projects: [
        { projectId: PROJECT_A, projectName: 'CRM', trafficLight: 'green' },
      ],
      items: [
        {
          id: 'item-1',
          projectId: PROJECT_A,
          type: 'current',
          text: 'Wire OAuth2 callback',
          tag: 'auth',
          workflowStatus: 'in_progress',
          carriedOver: false,
        },
      ],
    });

    const [mapped] = mapLeadItems(section, 'current');
    expect(mapped?.status).toBe('in-progress');
    expect(mapped?.text).toBe('Wire OAuth2 callback');
    expect(mapped?.productName).toBe('CRM');
    expect(mapped?.author).toBe('Polenkov A.');
  });

  it("filters items by 'next' type and resolves project name", () => {
    const section = baseSection({
      projects: [
        { projectId: PROJECT_A, projectName: 'CRM', trafficLight: 'green' },
        { projectId: PROJECT_B, projectName: 'Mobile', trafficLight: 'yellow' },
      ],
      items: [
        {
          id: 'i1',
          projectId: PROJECT_A,
          type: 'current',
          text: 'this week',
          tag: 'a',
          workflowStatus: 'in_progress',
          carriedOver: false,
        },
        {
          id: 'i2',
          projectId: PROJECT_B,
          type: 'next',
          text: 'next week',
          tag: 'b',
          workflowStatus: 'in_progress',
          carriedOver: false,
        },
      ],
    });

    const next = mapLeadItems(section, 'next');
    expect(next).toHaveLength(1);
    expect(expectDefined(next[0]).text).toBe('next week');
    expect(expectDefined(next[0]).productName).toBe('Mobile');
  });

  it('falls back to "Unknown" product name when projectId is unmapped', () => {
    const section = baseSection({
      items: [
        {
          id: 'orphan',
          projectId: '99999999-9999-4999-8999-999999999999',
          type: 'current',
          text: 'orphan item',
          tag: 'x',
          workflowStatus: 'in_progress',
          carriedOver: false,
        },
      ],
    });

    const [mapped] = mapLeadItems(section, 'current');
    expect(mapped?.productName).toBe('Unknown');
  });
});

describe('mapLeadRisks / mapLeadDecisions / mapLeadPriorities', () => {
  it('exposes risk + impact + mitigation as separate fields and resolves productName', () => {
    const section = baseSection({
      projects: [
        { projectId: PROJECT_A, projectName: 'CRM', trafficLight: 'yellow' },
      ],
      risks: [
        {
          id: 'r1',
          projectId: PROJECT_A,
          risk: 'OAuth delay',
          impact: 'SSO slips',
          mitigation: 'Escalate vendor',
        },
      ],
    });

    const [mapped] = mapLeadRisks(section);
    expect(mapped?.productName).toBe('CRM');
    expect(mapped?.severity).toBe('at-risk');
    // Phase 22+: text holds raw `risk` only; impact/mitigation surface as
    // separate fields in the edit dialog (avoids double-concat on save).
    expect(mapped?.text).toBe('OAuth delay');
    expect(mapped?.impact).toBe('SSO slips');
    expect(mapped?.mitigation).toBe('Escalate vendor');
  });

  it('passes decisions through with department-scope productName', () => {
    const section = baseSection({
      decisions: [
        {
          id: 'd1',
          text: 'Approve Redis cluster',
          owner: 'Head',
          impact: 'Caching',
        },
      ],
    });

    const [mapped] = mapLeadDecisions(section);
    expect(mapped?.text).toBe('Approve Redis cluster');
    expect(mapped?.productName).toBe('Department');
  });

  it('preserves arbitrary positive ranks (variable-length list) and floors invalid ranks to 1', () => {
    const section = baseSection({
      priorities: [
        { id: 'p1', rank: 1, text: 'P1' },
        { id: 'p2', rank: 5, text: 'P5' },
        { id: 'p3', rank: 0, text: 'invalid-zero' },
      ],
    });

    const mapped = mapLeadPriorities(section);
    expect(expectDefined(mapped[0]).rank).toBe(1);
    // Earlier variant clamped to 1|2|3 for a fixed-slot UI; the variable-length
    // priorities list now keeps the user's rank as-is when ≥ 1.
    expect(expectDefined(mapped[1]).rank).toBe(5);
    expect(expectDefined(mapped[1]).text).toBe('P5');
    expect(expectDefined(mapped[2]).rank).toBe(1);
  });
});

describe('mapLeadPeriods', () => {
  it('flags the active report id as isCurrent and submitted sections as isSubmitted', () => {
    const history: MyHistoryEntry[] = [
      {
        sectionId: SECTION_ID,
        reportId: REPORT_ID,
        periodStart: new Date('2026-04-14T00:00:00Z'),
        periodEnd: new Date('2026-04-20T00:00:00Z'),
        reportStatus: 'draft',
        sectionStatus: 'draft',
        submittedAt: null,
        publishedAt: null,
      },
      {
        sectionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        reportId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        periodStart: new Date('2026-04-07T00:00:00Z'),
        periodEnd: new Date('2026-04-13T00:00:00Z'),
        reportStatus: 'published',
        sectionStatus: 'submitted',
        submittedAt: new Date('2026-04-13T17:42:00Z'),
        publishedAt: new Date('2026-04-13T18:00:00Z'),
      },
    ];

    const periods = mapLeadPeriods(history, REPORT_ID);

    expect(expectDefined(periods[0]).isCurrent).toBe(true);
    expect(expectDefined(periods[0]).isSubmitted).toBe(false);
    expect(expectDefined(periods[1]).isCurrent).toBe(false);
    expect(expectDefined(periods[1]).isSubmitted).toBe(true);
    expect(expectDefined(periods[0]).dateRange).toBe('Apr 14-20');
  });
});

describe('mapLeadVersions', () => {
  it('formats createdAt into a relative timestamp and surfaces snapshot counts', () => {
    const now = new Date('2026-04-20T12:00:00Z');
    const versions: VersionSnapshot[] = [
      {
        id: 'v1',
        reportSectionId: SECTION_ID,
        version: 3,
        createdAt: new Date('2026-04-20T11:58:00Z'),
        itemCount: 4,
        riskCount: 2,
        decisionCount: 1,
      },
    ];
    const mapped = mapLeadVersions(versions, now);
    expect(expectDefined(mapped[0]).version).toBe(3);
    expect(expectDefined(mapped[0]).timestamp).toBe('2 min ago');
    expect(expectDefined(mapped[0]).itemCount).toBe(4);
    expect(expectDefined(mapped[0]).riskCount).toBe(2);
    expect(expectDefined(mapped[0]).decisionCount).toBe(1);
  });
});

describe('mapLeadFormData', () => {
  it('returns all empty collections when the section is empty', () => {
    const section = baseSection();
    const result = mapLeadFormData({
      active: section,
      byPeriod: { section, readOnly: false },
      versions: [],
      history: [],
    });
    expect(result.products).toEqual([]);
    expect(result.currentWeekItems).toEqual([]);
    expect(result.nextWeekItems).toEqual([]);
    expect(result.risks).toEqual([]);
    expect(result.decisions).toEqual([]);
    expect(result.priorities).toEqual([]);
    expect(result.periods).toEqual([]);
    expect(result.versions).toEqual([]);
    expect(result.readOnly).toBe(false);
    expect(result.currentUser.name).toBe('Polenkov A.');
    expect(result.currentUser.initials).toBe('PA');
  });

  it('locks readOnly when section status is submitted', () => {
    const section = baseSection({
      status: 'submitted',
      submittedAt: new Date('2026-04-20T18:00:00Z'),
    });
    const result = mapLeadFormData({
      active: section,
      byPeriod: { section, readOnly: false },
      versions: [],
      history: [],
    });
    expect(result.readOnly).toBe(true);
  });

  it('locks readOnly when byPeriod marks the period as read-only', () => {
    const section = baseSection();
    const result = mapLeadFormData({
      active: section,
      byPeriod: { section, readOnly: true },
      versions: [],
      history: [],
    });
    expect(result.readOnly).toBe(true);
  });
});
