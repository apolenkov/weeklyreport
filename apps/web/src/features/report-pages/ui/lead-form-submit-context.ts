import type { ReportSectionReadModel } from "@customreport/shared";

import type { DraftSaveContent } from "../../../hooks/use-lead-form-autosave";
import {
  applyCrossAuthorStageOverrides,
  buildCrossAuthorStageMap,
  type CrossAuthorRow,
  type KanbanItem,
  mapLeadProducts,
  type Product,
} from "../../report-sections";

// Plain per-render args for draft callbacks; readiness stays on the live draft.
export interface LeadFormLoadedContext {
  readonly products: readonly Product[];
  readonly currentWeekItems: readonly KanbanItem[];
  readonly nextWeekItems: readonly KanbanItem[];
}

// Live-draft products for the submit gate; re-apply cross-author overrides
// in Everyone so the coupling gate matches the loaded view model.
/**
 * Build Readiness Products.
 * @param section - The section argument.
 * @param isEveryone - The isEveryone argument.
 * @param crossAuthors - The crossAuthors argument.
 */
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

// Locked stages never appear in the draft payload — exclude them from the
// positional label lookup so owned-stage names stay aligned.
/**
 * Build Submit Stages.
 * @param draftPayload - The draftPayload argument.
 * @param products - The products argument.
 */
export function buildSubmitStages(
  draftPayload: DraftSaveContent | null,
  products: readonly Product[],
): { projectId: string; stageId: string; name: string }[] {
  return (draftPayload?.stageStatuses ?? []).map((status, index, statuses) => {
    const product = products.find(
      (candidate) => candidate.id === status.projectId,
    );
    const stageIndex = statuses
      .slice(0, index)
      .filter((candidate) => candidate.projectId === status.projectId).length;
    const ownedStages = product?.stages.filter(
      (stage) => stage.ownership === "mine",
    );
    return {
      projectId: status.projectId,
      stageId: status.stageId,
      name: ownedStages?.[stageIndex]?.stageName ?? status.stageId,
    };
  });
}
