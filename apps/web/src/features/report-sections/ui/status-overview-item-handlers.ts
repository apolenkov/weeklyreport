import type { ItemWorkflowStatus } from "@customreport/shared";

import type {
  StatusOverviewCreateTarget,
  StatusOverviewEditTarget,
  StatusOverviewItem,
} from "../model/status-overview";
import type { StatusOverviewEditorSlot } from "./status-overview-editor-slot";

/** Overview row callbacks threaded from the shell into every timeline lane. */
export interface ItemHandlers {
  readonly editorSlot?: StatusOverviewEditorSlot | undefined;
  readonly onEditItem?:
    ((target: StatusOverviewEditTarget) => void) | undefined;
  readonly onAddItem?:
    ((target: StatusOverviewCreateTarget) => void) | undefined;
  readonly onPlanItem?: ((item: StatusOverviewItem) => void) | undefined;
  readonly onMoveItem?:
    | ((
        item: StatusOverviewItem,
        target: "current" | "next",
        focusKey?: string,
      ) => void)
    | undefined;
  readonly onConfirmItem?: ((item: StatusOverviewItem) => void) | undefined;
  readonly onSetStatus?:
    | ((
        item: StatusOverviewItem,
        status: ItemWorkflowStatus,
        focusKey?: string,
      ) => void)
    | undefined;
  readonly onResolvePlan?:
    ((item: StatusOverviewItem, focusKey?: string) => void) | undefined;
  readonly onRestorePlan?:
    ((item: StatusOverviewItem, focusKey?: string) => void) | undefined;
  /** Linked Next commitment on the same Current item (never a type-flip). The
   * promise form is the audited replacement path, which reports its own
   * failure so the editor can retain the chosen text. */
  readonly onLinkedContinuation?:
    | ((item: StatusOverviewItem, text: string) => void | Promise<void>)
    | undefined;
  /** Promotes the linked Next into the active result. */
  readonly onPromoteContinuation?:
    ((item: StatusOverviewItem) => void) | undefined;
  /** Reports an open linked-continuation editor by its stable id. */
  readonly onLinkedEditingChange?:
    ((editorId: string, editing: boolean) => void) | undefined;
}
