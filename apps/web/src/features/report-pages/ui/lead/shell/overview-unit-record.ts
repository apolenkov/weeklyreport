import type { StatusOverviewRecordTarget } from "../../../../report-sections";
import type { ReadyEditor } from "./use-overview-controller";

/**
 * The unit's own "+ Risk" / "+ Decision": the usual editor opens with that
 * Product or Activity already chosen. Nothing is written until the Lead saves.
 */
export function unitRecordStarter(
  editor: ReadyEditor | null,
): ((target: StatusOverviewRecordTarget) => void) | undefined {
  if (!editor) return undefined;
  return (target) => {
    const parent =
      target.unitKind === "product"
        ? { productId: target.unitId }
        : { activityId: target.unitId };
    if (target.kind === "decision") {
      editor.view.draftActions.addDecisionFor(parent);
      return;
    }
    editor.draft.routeToBlocker({
      productId: "",
      stageNames: [],
      severity: "at-risk",
      ...parent,
    });
  };
}
