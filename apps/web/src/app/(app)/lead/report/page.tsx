'use client';

import {
  reportSectionReadModelSchema,
  type DraftSavePayload,
  type ReportSectionReadModel,
  type SubmitSectionPayload,
} from '@customreport/shared';

import { AppShell } from '../../../../components/navigation/app-shell';
import { ReportSectionForm } from '../../../../components/report-section/report-section-form';
import { createDemoSection } from '../../../../components/report-section/demo-section';
import {
  persistLeadSection,
  readStoredLeadSection,
} from '../../../../components/report-section/section-storage';
import { defaultLeadSession, readBrowserSession } from '../../../../lib/dev-session';
import { useBrowserState } from '../../../../lib/use-browser-state';

export default function LeadReportPage() {
  const [session] = useBrowserState(defaultLeadSession, () => readBrowserSession(defaultLeadSession));
  const [section, setSection] = useBrowserState<ReportSectionReadModel>(
    createDemoSection(),
    readStoredLeadSection,
  );

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
    <AppShell activeReportId={session.activeReportId} role={session.role} currentPath="/lead/report">
      <ReportSectionForm
        initialSection={section}
        onSaveDraft={handleSaveDraft}
        onSubmit={handleSubmit}
      />
    </AppShell>
  );
}
