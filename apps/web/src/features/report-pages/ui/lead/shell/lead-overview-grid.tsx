import type { ComponentProps, RefObject } from "react";

import {
  OverviewRecordContext,
  StatusOverview,
  type StatusOverviewItem,
} from "../../../../report-sections";
import type { OverviewItemDialogState } from "./lead-status-overview-item-editor";
import { overviewItemActions } from "./overview-plan-presentation";
import type { ReadyEditor } from "./use-overview-controller";
interface OverviewDialogSlice {
  readonly dialog: OverviewItemDialogState | null;
  readonly recoveryReason: string | null;
  readonly close: () => void;
  readonly requestCloseRef: RefObject<(() => void) | null>;
  readonly moveItem: (
    item: StatusOverviewItem,
    target: "current" | "next",
    focusKey?: string,
  ) => void;
  readonly confirmItem: (item: StatusOverviewItem) => void;
  readonly setItemStatus: NonNullable<
    ComponentProps<typeof StatusOverview>["onSetStatus"]
  >;
  readonly setItemStages: NonNullable<
    ComponentProps<typeof StatusOverview>["onSetStages"]
  >;
}

type OverviewVerdictSlice = Pick<
  ComponentProps<typeof StatusOverview>,
  "onVerdict" | "onConfirmAll" | "pendingReviewCount" | "onAddRecord"
>;

function overviewDirectActions(
  enabled: boolean,
  dialog: OverviewDialogSlice,
  verdict: OverviewVerdictSlice,
) {
  return enabled
    ? {
        onAddRecord: verdict.onAddRecord,
        onMoveItem: dialog.moveItem,
        onConfirmItem: dialog.confirmItem,
        onSetStatus: dialog.setItemStatus,
        onSetStages: dialog.setItemStages,
        onVerdict: verdict.onVerdict,
        onConfirmAll: verdict.onConfirmAll,
        pendingReviewCount: verdict.pendingReviewCount,
      }
    : {};
}

type GridProps = ComponentProps<typeof StatusOverview>;
interface OverviewGridProps {
  readonly activeRecord: React.ContextType<
    typeof OverviewRecordContext
  >["active"];
  readonly onReasonDraft: NonNullable<
    React.ContextType<typeof OverviewRecordContext>["onReasonDraft"]
  >;
  readonly deleteUnitRecord: NonNullable<
    React.ContextType<typeof OverviewRecordContext>["deleteRecord"]
  >;
  readonly move: NonNullable<GridProps["onMoveItem"]>;
  readonly canStartAction: boolean;
  readonly canEdit: boolean;
  readonly readyEditor: ReadyEditor | null;
  readonly ownedStageStartsForProduct: GridProps["ownedStageStartsForProduct"];
  readonly lineage: GridProps["lineage"];
  readonly model: GridProps["model"];
  readonly health: GridProps["health"];
  readonly itemSlot: GridProps["editorSlot"];
  readonly planPresentation: { slot: GridProps["editorSlot"] };
  readonly recordPresentation: { slot: GridProps["recordSlot"] };
  readonly dialog: OverviewDialogSlice &
    Parameters<typeof overviewItemActions>[1] & {
      addItem: NonNullable<GridProps["onAddItem"]>;
    };
  readonly plan: Parameters<typeof overviewItemActions>[2];
  readonly verdict: OverviewVerdictSlice;
  readonly onActivityFieldsChange: GridProps["onActivityFieldsChange"];
  readonly onActivityFieldsPendingChange: GridProps["onActivityFieldsPendingChange"];
  readonly detailsHref: GridProps["detailsHref"];
}
export function OverviewGrid(controller: OverviewGridProps) {
  const {
    readyEditor,
    model,
    itemSlot,
    dialog,
    plan,
    verdict,
    detailsHref,
    canStartAction,
  } = controller;
  return (
    <OverviewRecordContext.Provider
      value={{
        active: controller.activeRecord,
        onReasonDraft: controller.onReasonDraft,
        deleteRecord: controller.canStartAction
          ? controller.deleteUnitRecord
          : undefined,
        submitted: readyEditor?.view.isSubmitted === true,
      }}
    >
      <StatusOverview
        editable={controller.canEdit}
        model={model}
        lineage={controller.lineage}
        ownedStageStartsForProduct={controller.ownedStageStartsForProduct}
        health={controller.health}
        editorSlot={itemSlot ?? controller.planPresentation.slot}
        recordSlot={controller.recordPresentation.slot}
        {...overviewItemActions(canStartAction, dialog, plan)}
        onAddItem={itemSlot || canStartAction ? dialog.addItem : undefined}
        {...overviewDirectActions(canStartAction, dialog, verdict)}
        onVerdict={
          canStartAction
            ? verdict.onVerdict
            : controller.canEdit
              ? () => Promise.resolve("Save or cancel your changes first.")
              : undefined
        }
        onMoveItem={canStartAction ? controller.move : undefined}
        detailsHref={detailsHref}
        activityFieldsEditable={controller.canEdit}
        onActivityFieldsChange={controller.onActivityFieldsChange}
        onActivityFieldsPendingChange={controller.onActivityFieldsPendingChange}
      />
    </OverviewRecordContext.Provider>
  );
}
