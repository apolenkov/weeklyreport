import type { ReactNode } from "react";

import type {
  StatusOverviewCreateTarget,
  StatusOverviewEditorSlot,
  StatusOverviewEditTarget,
  StatusOverviewItem,
  StatusOverviewModel,
} from "../../../../report-sections";
import type {
  OverviewPlanFields,
  OverviewPlanState,
  PlanOutcome,
} from "./overview-plan-command";
import { OverviewPlanComposer } from "./overview-plan-composer";
interface PlanActions {
  readonly dialog: OverviewPlanState | null;
  readonly pending: boolean;
  readonly blockedReason: string | null;
  readonly recoveryReason: string | null;
  readonly error: string | null;
  readonly choose: (outcome: PlanOutcome) => void;
  readonly change: (patch: Partial<OverviewPlanFields>) => void;
  readonly submit: () => void;
  readonly close: () => void;
  readonly resolve: (item: StatusOverviewItem, focusKey?: string) => void;
  readonly restore: (item: StatusOverviewItem, focusKey?: string) => void;
}

interface ItemActions {
  readonly editItem: (target: StatusOverviewEditTarget) => void;
  readonly addItem: (target: StatusOverviewCreateTarget) => void;
  readonly planItem: (item: StatusOverviewItem) => void;
}

function planSlot(
  state: OverviewPlanState,
  model: StatusOverviewModel,
  content: ReactNode,
): StatusOverviewEditorSlot | undefined {
  const unit = model.units.find((candidate) => candidate.key === state.unitKey);
  if (!unit) return undefined;
  const visible = Object.values(unit.columns).some((column) =>
    column.items.some(
      (item) =>
        item.source === state.item.source &&
        item.stableId === state.item.stableId,
    ),
  );
  if (!visible) return undefined;
  return {
    mode: "resolve",
    unitKey: unit.key,
    source: state.item.source,
    recordId: state.item.recordId,
    stableId: state.item.stableId,
    content,
  };
}

export function overviewPlanPresentation(
  plan: PlanActions,
  model: StatusOverviewModel,
) {
  if (!plan.dialog) return { slot: undefined, recovery: null };
  const composer = (
    <OverviewPlanComposer
      state={plan.dialog}
      pending={plan.pending}
      blockedReason={plan.blockedReason}
      recoveryReason={plan.recoveryReason}
      error={plan.error}
      onChoose={plan.choose}
      onChange={plan.change}
      onSubmit={plan.submit}
      onCancel={plan.close}
    />
  );
  const slot = plan.recoveryReason
    ? undefined
    : planSlot(plan.dialog, model, composer);
  return { slot, recovery: slot ? null : composer };
}

export function overviewItemActions(
  enabled: boolean,
  editor: ItemActions,
  plan: PlanActions,
) {
  return enabled
    ? {
        onEditItem: editor.editItem,
        onAddItem: editor.addItem,
        onPlanItem: editor.planItem,
        onResolvePlan: plan.resolve,
        onRestorePlan: plan.restore,
      }
    : {};
}
