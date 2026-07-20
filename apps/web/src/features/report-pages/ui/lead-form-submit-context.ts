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

/**
 * Per-render view-model inputs the draft module needs for its interaction
 * callbacks (quick-add merges and the blocker default product). Passed as plain
 * render args every render, never a cross-file ref. Draft-derived readiness does
 * NOT flow through here; it is computed from the module's own live draft so it
 * stays a render fresh.
 */
export interface LeadFormLoadedContext {
  readonly products: readonly Product[];
  readonly currentWeekItems: readonly KanbanItem[];
  readonly nextWeekItems: readonly KanbanItem[];
}

/**
 * The products the submit gate reads, derived from the live draft. In the
 * Everyone lens the cross-author status overrides are re-applied exactly as the
 * loaded view model does, so the coupling gate stays byte-identical to the
 * pre-module readiness while being computed a render fresh from the draft.
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

/** Result of a submit attempt, surfaced to the write-actions dialog lifecycle. */
export type SubmitOutcome =
  "submitted" | "conflict" | "error" | "not-ready" | "no-draft";

/**
 * Projects the submit-readiness stage rows from the draft payload's stage
 * statuses, resolving each stage's display name from the products. Duplicated
 * stage ids per project keep positional labels (the pre-module inline mapping).
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
    return {
      projectId: status.projectId,
      stageId: status.stageId,
      name: product?.stages[stageIndex]?.stageName ?? status.stageId,
    };
  });
}
