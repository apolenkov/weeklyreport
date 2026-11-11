import type { ReportHealthPulse } from "../model/report-health-pulse";
import type {
  StatusOverviewCreateTarget,
  StatusOverviewEditTarget,
  StatusOverviewItem,
  StatusOverviewModel,
  StatusOverviewRecordTarget,
} from "../model/status-overview";
import type { StatusOverviewActivityFieldsChange } from "./status-overview-activity-editor";
import type {
  StatusOverviewEditorSlot,
  StatusOverviewRecordSlot,
} from "./status-overview-editor-slot";
import type {
  SetStagesHandler,
  SetStatusHandler,
  VerdictHandler,
} from "./status-overview-item-handlers";

export interface StatusOverviewProps {
  readonly health?: ReportHealthPulse | undefined;
  readonly editorSlot?: StatusOverviewEditorSlot | undefined;
  readonly recordSlot?: StatusOverviewRecordSlot | undefined;
  readonly model: StatusOverviewModel;
  readonly onEditItem?:
    ((target: StatusOverviewEditTarget) => void) | undefined;
  /** Commits the inline in-place text edit of one editable item. */
  readonly onEditItemText?:
    ((item: StatusOverviewItem, text: string) => void) | undefined;
  readonly onAddItem?:
    ((target: StatusOverviewCreateTarget) => void) | undefined;
  /** Starts a risk or decision already bound to the unit it was raised from. */
  readonly onAddRecord?:
    ((target: StatusOverviewRecordTarget) => void) | undefined;
  readonly ownedStageStartsForProduct?:
    ((productId: string) => readonly string[]) | undefined;
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
  readonly onSetStages?: SetStagesHandler | undefined;
  readonly onResolvePlan?:
    ((item: StatusOverviewItem, focusKey?: string) => void) | undefined;
  readonly onRestorePlan?:
    ((item: StatusOverviewItem, focusKey?: string) => void) | undefined;
  readonly onVerdict?: VerdictHandler | undefined;
  /** Unconfirmed carried continuations; the confirm-all action shows above zero. */
  readonly pendingReviewCount?: number | undefined;
  readonly onConfirmAll?: (() => void) | undefined;
  /** Linked Next commitment on the same Current item (never a type-flip); the
   * promise form is the audited replacement path. */
  readonly onLinkedContinuation?:
    | ((item: StatusOverviewItem, text: string) => void | Promise<void>)
    | undefined;
  /** Promotes the linked Next into the active result (audited server command). */
  readonly onPromoteContinuation?:
    ((item: StatusOverviewItem) => void) | undefined;
  /** Reports an open linked-continuation editor by its stable id. */
  readonly onLinkedEditingChange?:
    ((editorId: string, editing: boolean) => void) | undefined;
  readonly detailsHref?: string | undefined;
  readonly autosaveStatus?: string | undefined;
  /** Enable the per-activity weekly title/description editor. */
  readonly activityFieldsEditable?: boolean | undefined;
  readonly onActivityFieldsChange?:
    | ((activityId: string, next: StatusOverviewActivityFieldsChange) => void)
    | undefined;
  readonly onActivityFieldsPendingChange?:
    ((activityId: string, pending: boolean) => void) | undefined;
}
