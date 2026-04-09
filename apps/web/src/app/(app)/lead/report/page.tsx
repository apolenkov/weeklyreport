'use client';

import { useMemo, useState } from 'react';

import {
  reportSectionReadModelSchema,
  type DraftSavePayload,
  type ReportSectionReadModel,
  type SubmitSectionPayload,
} from '@customreport/shared';

import { AppShell } from '../../../../components/navigation/app-shell';
import { ReportSectionForm } from '../../../../components/report-section/report-section-form';
import {
  persistLeadSection,
  readStoredLeadSection,
} from '../../../../components/report-section/section-storage';
import { defaultLeadSession, readBrowserSession } from '../../../../lib/dev-session';

export default function LeadReportPage() {
  const session = useMemo(() => readBrowserSession(defaultLeadSession), []);
  const [section, setSection] = useState<ReportSectionReadModel>(() =>
    readStoredLeadSection(),
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
    const persisted = persistLeadSection(nextSection);
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
    const persisted = persistLeadSection(submittedSection);
    setSection(persisted);

    return persisted;
  }

  return (
    <AppShell role={session.role} currentPath="/lead/report">
      <ReportSectionForm
        initialSection={initialSection}
        onSaveDraft={handleSaveDraft}
        onSubmit={handleSubmit}
      />
    </AppShell>
  );
}
