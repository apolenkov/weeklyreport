import { authorReportSectionReadModelSchema } from "@weeklyreport/shared";
import { vi } from "vitest";

import {
  leadFormGenerationOf,
  type StatusOverviewModel,
} from "../../../../../report-sections";
import { buildAutosaveHarness } from "../../../../../report-sections/model/autosave/use-lead-form-autosave-harness";
import { formSectionOf } from "../../../../../report-sections/model/form-section";
import { makeDraftMergeSection } from "../../../../../report-sections/model/lead-form/draft/lead-form-draft-merge-test-fixtures";
import type { LeadFormDraftSaveInput } from "../../../../../report-sections/model/lead-form/lead-form-write-port";
import { useLeadFormDraftCore } from "../../../../../report-sections/model/lead-form/use-lead-form-draft-core";
import { mapLeadProducts } from "../../../../../report-sections/model/lead-form-periods-products";
import type { ReadyEditor } from "../use-overview-controller";
import { useOverviewRecordEditor } from "../use-overview-record-editor";

export function buildRecordEditorHarness(
  mutationFn?: NonNullable<
    Parameters<typeof buildAutosaveHarness>[0]
  >["mutationFn"],
) {
  const server = makeDraftMergeSection();
  const reply = (request: LeadFormDraftSaveInput) =>
    formSectionOf(
      authorReportSectionReadModelSchema.parse({
        ...server,
        version: request.version + 1,
        items: request.items,
        risks: request.risks.map((row) => ({
          ...row,
          id: crypto.randomUUID(),
        })),
        decisions: request.decisions.map((row) => ({
          ...row,
          id: crypto.randomUUID(),
          owner: server.authorName,
        })),
      }),
    );
  const harness = buildAutosaveHarness({
    mutationFn: mutationFn ?? ((request) => Promise.resolve(reply(request))),
  });
  const refetchSection = vi.fn().mockResolvedValue(undefined);
  const generation = leadFormGenerationOf(server);
  function useEditor({
    readOnly = false,
    unavailable = false,
    scopeChanged = false,
    serverSection = server,
  } = {}) {
    const draft = useLeadFormDraftCore({
      writePort: harness.writePort,
      generation,
      serverSection,
      sectionIdForActions: server.reportSectionId,
      serverReadOnly: readOnly,
      refetchSection,
    });
    const section = draft.draft ?? server;
    const editor = {
      status: "ready",
      generation,
      draft: {
        ...draft,
        section,
        receiptScope: scopeChanged ? "new-activation" : draft.receiptScope,
      },
      view: {
        viewModel: { isReadOnly: readOnly, products: mapLeadProducts(section) },
      },
    } as unknown as ReadyEditor;
    const model = {
      units: [
        ...section.projects.map((project) => ({
          kind: "product",
          id: project.projectId,
          key: `product:${project.projectId}`,
          name: project.projectName,
          historical: false,
        })),
        ...section.activities.map((activity) => ({
          kind: "activity",
          id: activity.activityId,
          key: `activity:${activity.activityId}`,
          name: activity.activityName,
          historical: false,
        })),
      ],
    } as unknown as StatusOverviewModel;
    const record = useOverviewRecordEditor(
      unavailable ? null : editor,
      model,
      server.reportId,
      false,
    );
    return { record, draft, editor, model };
  }
  return { ...harness, useEditor, server, reply };
}
