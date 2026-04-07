import { describe, expect, it } from 'vitest';

import { roleSchema } from '../schemas/auth';
import {
  draftSaveSchema,
  reportSectionReadModelSchema,
  submitSectionSchema,
  submissionDashboardRowSchema,
} from '../schemas/report';

const sectionId = '11111111-1111-4111-8111-111111111111';
const reportId = '22222222-2222-4222-8222-222222222222';
const authorId = '33333333-3333-4333-8333-333333333333';
const projectId = '44444444-4444-4444-8444-444444444444';

describe('shared auth/report schemas', () => {
  it('accepts only supported roles', () => {
    expect(roleSchema.parse('lead')).toBe('lead');
    expect(() => roleSchema.parse('admin')).toThrow();
  });

  it('allows draft payloads without mandatory traffic-light values', () => {
    const parsed = draftSaveSchema.parse({
      reportSectionId: sectionId,
      projectStatuses: [{ projectId }],
      items: [
        {
          projectId,
          type: 'current',
          text: 'Build entry form',
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
    });

    expect(parsed.status).toBe('draft');
    expect(parsed.projectStatuses[0]?.status).toBeUndefined();
  });

  it('requires confirmed submit payloads with strict project-status values', () => {
    expect(() =>
      submitSectionSchema.parse({
        reportSectionId: sectionId,
        confirmed: true,
        projectStatuses: [{ projectId }],
        items: [
          {
            projectId,
            type: 'current',
            text: 'Submit item',
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
      }),
    ).toThrow();

    const parsed = submitSectionSchema.parse({
      reportSectionId: sectionId,
      confirmed: true,
      projectStatuses: [{ projectId, status: 'green' }],
      items: [
        {
          projectId,
          type: 'current',
          text: 'Submit item',
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
    });

    expect(parsed.confirmed).toBe(true);
    expect(parsed.projectStatuses[0]?.status).toBe('green');
  });

  it('parses report-section and dashboard read models', () => {
    const section = reportSectionReadModelSchema.parse({
      reportSectionId: sectionId,
      reportId,
      authorId,
      authorName: 'Lead 1',
      status: 'draft',
      submittedAt: null,
      projects: [{ projectId, projectName: 'Project 1', trafficLight: null }],
      items: [],
      risks: [],
      decisions: [],
      priorities: [
        { rank: 1, text: 'Priority 1' },
        { rank: 2, text: 'Priority 2' },
        { rank: 3, text: 'Priority 3' },
      ],
    });
    const dashboardRows = submissionDashboardRowSchema.array().parse([
      {
        leadId: authorId,
        leadName: 'Lead 1',
        role: 'lead',
        projectNames: ['Project 1'],
        status: 'submitted',
        submittedAt: '2026-04-09T10:00:00.000Z',
      },
    ]);

    expect(section.authorName).toBe('Lead 1');
    expect(dashboardRows[0]?.status).toBe('submitted');
  });
});
