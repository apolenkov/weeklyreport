import type { ItemWorkflowStatus } from "@weeklyreport/shared";

import type { ItemStatusInput } from "../model/lead-actions/lead-item-status-patch";
import type {
  StatusOverviewCreateTarget,
  StatusOverviewEditTarget,
  StatusOverviewItem,
} from "../model/status-overview";
import type { PlanVerdict } from "../model/status-overview-verdict";
import type { StatusOverviewEditorSlot } from "./status-overview-editor-slot";

/** Records a verdict for a Previously planned item; resolves to a failure message, or null when recorded. */
export type VerdictHandler = (
  item: StatusOverviewItem,
  verdict: PlanVerdict,
  reason?: string,
) => Promise<string | null>;

export type SetStatusHandler = (
  item: StatusOverviewItem,
  status: ItemWorkflowStatus,
  focusKey?: string,
  input?: ItemStatusInput,
) => void | Promise<string | null>;

/** Overview row callbacks threaded from the shell into every timeline lane. */
export interface ItemHandlers {
  readonly editorSlot?: StatusOverviewEditorSlot | undefined;
  readonly onEditItem?:
    ((target: StatusOverviewEditTarget) => void) | undefined;
  /** Commits the inline in-place text edit of one editable item. */
  readonly onEditItemText?:
    ((item: StatusOverviewItem, text: string) => void) | undefined;
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
  readonly onSetStatus?: SetStatusHandler | undefined;
  readonly onResolvePlan?:
    ((item: StatusOverviewItem, focusKey?: string) => void) | undefined;
  readonly onRestorePlan?:
    ((item: StatusOverviewItem, focusKey?: string) => void) | undefined;
  readonly onVerdict?: VerdictHandler | undefined;
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
