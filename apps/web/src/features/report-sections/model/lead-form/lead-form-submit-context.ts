import type { ReportSectionReadModel } from "@weeklyreport/shared";

import type { CrossAuthorRow } from "../lead-cross-author";
import {
  applyCrossAuthorStageOverrides,
  buildCrossAuthorStageMap,
} from "../lead-cross-author";
import { mapLeadProducts, mapLeadRisks } from "../lead-form";
import type { DraftSaveContent } from "../lead-section-draft-payload";
import { deriveLeadSubmitReadiness } from "../lead-submit-readiness";
import type { KanbanItem, Product } from "../types";

// Plain per-render args for draft callbacks; readiness stays on the live draft.
export interface LeadFormLoadedContext {
  readonly products: readonly Product[];
  readonly currentWeekItems: readonly KanbanItem[];
  readonly nextWeekItems: readonly KanbanItem[];
}

// Live-draft products for the submit gate; re-apply cross-author overrides
// in Everyone so the coupling gate matches the loaded view model.
export function buildReadinessProducts(
  section: ReportSectionReadModel,
  isEveryone: boolean,
  crossAuthors: readonly CrossAuthorRow[],
): Product[] {
  const base = mapLeadProducts(section);
  return isEveryone
    ? applyCrossAuthorStageOverrides(
        base,
        buildCrossAuthorStageMap(crossAuthors),
      )
    : base;
}

export type SubmitOutcome =
  "submitted" | "conflict" | "error" | "not-ready" | "no-draft";

// Resolve labels from the server-owned stage identity. A stage whose label
// cannot be resolved is null (never the raw stage id dressed as copy).
export function buildSubmitStages(
  draftPayload: DraftSaveContent | null,
  draftSection: Pick<ReportSectionReadModel, "projects"> | null,
): { projectId: string; stageId: string; name: string | null }[] {
  const stageNamesByProject = new Map(
    (draftSection?.projects ?? []).map((project) => [
      project.projectId,
      new Map(
        project.ownedStages.map((stage) => [stage.stageId, stage.stageName]),
      ),
    ]),
  );
  return (draftPayload?.stageStatuses ?? []).map((status) => {
    return {
      projectId: status.projectId,
      stageId: status.stageId,
      name:
        stageNamesByProject.get(status.projectId)?.get(status.stageId) ?? null,
    };
  });
}

type ReadinessInput = Parameters<typeof deriveLeadSubmitReadiness>[0];

interface LeadSubmitReadinessArgs {
  readonly draftSection: ReportSectionReadModel | null;
  readonly draftPayload: DraftSaveContent | null;
  readonly products: ReadinessInput["products"];
  readonly autosaveState: ReadinessInput["autosaveState"];
  readonly submitPending: boolean;
}

// The gate reads the live draft, so a lead sees readiness before autosave lands.
export function buildLeadSubmitReadiness({
  draftSection,
  draftPayload,
  products,
  autosaveState,
  submitPending,
}: LeadSubmitReadinessArgs) {
  return deriveLeadSubmitReadiness({
    draftSection,
    draftPayload,
    products,
    activities: (draftSection?.activities ?? []).map((activity) => ({
      id: activity.activityId,
      name: activity.activityName,
    })),
    stages: buildSubmitStages(draftPayload, draftSection),
    ownRisks: draftSection ? mapLeadRisks(draftSection) : [],
    autosaveState,
    submitPending,
  });
}
