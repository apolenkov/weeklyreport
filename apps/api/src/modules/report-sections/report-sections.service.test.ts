import { describe, expect, it } from 'vitest';

import type { ReportSectionReadModel } from '@customreport/shared';

import {
  ReportSectionsService,
  type ReportSectionsRepository,
} from './report-sections.service';

const baseSection: ReportSectionReadModel = {
  reportSectionId: '11111111-1111-4111-8111-111111111111',
  reportId: '22222222-2222-4222-8222-222222222222',
  authorId: '33333333-3333-4333-8333-333333333333',
  authorName: 'Lead 1',
  status: 'draft',
  submittedAt: null,
  projects: [
    {
      projectId: '44444444-4444-4444-8444-444444444444',
      projectName: 'Project 1',
      trafficLight: null,
    },
  ],
  items: [
    {
      projectId: '44444444-4444-4444-8444-444444444444',
      type: 'current',
      text: 'Current item',
      tag: 'feature',
      workflowStatus: 'in_progress',
      carriedOver: false,
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

function createRepository(section: ReportSectionReadModel): ReportSectionsRepository {
  let currentSection = structuredClone(section);

  return {
    async getSectionById(reportSectionId) {
      if (reportSectionId !== currentSection.reportSectionId) {
        return null;
      }

      return structuredClone(currentSection);
    },
    async getReportStatus() {
      return 'draft';
    },
    async saveSection(nextSection) {
      currentSection = structuredClone(nextSection);

      return structuredClone(currentSection);
    },
  };
}

describe('ReportSectionsService', () => {
  it('loads a lead section as one typed payload', async () => {
    const service = new ReportSectionsService(createRepository(baseSection));

    await expect(
      service.getActiveSection(baseSection.reportSectionId),
    ).resolves.toMatchObject({
      reportSectionId: baseSection.reportSectionId,
      projects: [{ projectName: 'Project 1' }],
      items: [{ text: 'Current item' }],
      priorities: [
        { rank: 1, text: 'Priority 1' },
        { rank: 2, text: 'Priority 2' },
        { rank: 3, text: 'Priority 3' },
      ],
    });
  });

  it('saves draft without changing submitted state', async () => {
    const service = new ReportSectionsService(createRepository(baseSection));
    const saved = await service.saveDraft({
      reportSectionId: baseSection.reportSectionId,
      status: 'draft',
      projectStatuses: [
        {
          projectId: baseSection.projects[0]!.projectId,
          status: 'yellow',
        },
      ],
      items: baseSection.items,
      risks: [],
      decisions: [],
      priorities: baseSection.priorities,
    });

    expect(saved.status).toBe('draft');
    expect(saved.submittedAt).toBeNull();
    expect(saved.projects[0]?.trafficLight).toBe('yellow');
  });

  it('rejects submit when traffic light is missing', async () => {
    const service = new ReportSectionsService(createRepository(baseSection));

    await expect(
      service.submitSection({
        reportSectionId: baseSection.reportSectionId,
        status: 'draft',
        confirmed: true,
        projectStatuses: [
          {
            projectId: '99999999-9999-4999-8999-999999999999',
            status: 'green',
          },
        ],
        items: baseSection.items,
        risks: [],
        decisions: [],
        priorities: baseSection.priorities,
      }),
    ).rejects.toMatchObject({
      code: 'MISSING_TRAFFIC_LIGHT',
    });
  });

  it('rejects a second submit for an already-submitted section', async () => {
    const service = new ReportSectionsService(
      createRepository({
        ...baseSection,
        status: 'submitted',
        submittedAt: new Date('2026-04-06T12:00:00.000Z'),
        projects: [{ ...baseSection.projects[0]!, trafficLight: 'green' }],
      }),
    );

    await expect(
      service.submitSection({
        reportSectionId: baseSection.reportSectionId,
        status: 'draft',
        confirmed: true,
        projectStatuses: [
          {
            projectId: baseSection.projects[0]!.projectId,
            status: 'green',
          },
        ],
        items: baseSection.items,
        risks: [],
        decisions: [],
        priorities: baseSection.priorities,
      }),
    ).rejects.toMatchObject({
      code: 'SECTION_ALREADY_SUBMITTED',
    });
  });
});
