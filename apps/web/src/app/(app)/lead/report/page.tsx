'use client';

import { useMemo, useState } from 'react';

import {
  reportSectionReadModelSchema,
  type DraftSavePayload,
  type ReportSectionReadModel,
  type SubmitSectionPayload,
} from '@customreport/shared';

import { createDemoSection } from '../../../../components/report-section/demo-section';
import { ReportSectionForm } from '../../../../components/report-section/report-section-form';

const STORAGE_KEY = 'customreport:lead-report-section';

function readStoredSection(): ReportSectionReadModel {
  if (typeof window === 'undefined') {
    return createDemoSection();
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return createDemoSection();
  }

  return reportSectionReadModelSchema.parse(JSON.parse(rawValue));
}

function persistSection(section: ReportSectionReadModel): ReportSectionReadModel {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(section));

  return section;
}

export default function LeadReportPage() {
  const [section, setSection] = useState<ReportSectionReadModel>(() =>
    readStoredSection(),
  );

  const initialSection = useMemo(() => section, [section]);

  async function handleSaveDraft(
    input: DraftSavePayload,
  ): Promise<ReportSectionReadModel> {
    const nextSection = reportSectionReadModelSchema.parse({
      ...section,
      status: 'draft',
      submittedAt: null,
      projects: section.projects.map((project) => ({
        ...project,
        trafficLight:
          input.projectStatuses.find((status) => status.projectId === project.projectId)
            ?.status ?? null,
      })),
      items: input.items,
      risks: input.risks,
      decisions: input.decisions,
      priorities: input.priorities,
    });

    await new Promise((resolve) => window.setTimeout(resolve, 50));
    const persisted = persistSection(nextSection);
    setSection(persisted);

    return persisted;
  }

  async function handleSubmit(
    input: SubmitSectionPayload,
  ): Promise<ReportSectionReadModel> {
    const submittedSection = reportSectionReadModelSchema.parse({
      ...section,
      status: 'submitted',
      submittedAt: new Date(),
      projects: section.projects.map((project) => ({
        ...project,
        trafficLight:
          input.projectStatuses.find((status) => status.projectId === project.projectId)
            ?.status ?? null,
      })),
      items: input.items,
      risks: input.risks,
      decisions: input.decisions,
      priorities: input.priorities,
    });

    await new Promise((resolve) => window.setTimeout(resolve, 50));
    const persisted = persistSection(submittedSection);
    setSection(persisted);

    return persisted;
  }

  return (
    <main>
      <ReportSectionForm
        initialSection={initialSection}
        onSaveDraft={handleSaveDraft}
        onSubmit={handleSubmit}
      />
    </main>
  );
}
