import type { ReportHealthPulse } from "../model/report-health-pulse";
import type {
  StatusOverviewCreateTarget,
  StatusOverviewEditTarget,
  StatusOverviewItem,
  StatusOverviewLinkedMemory,
  StatusOverviewModel,
  StatusOverviewQuickEditMemory,
} from "../model/status-overview";
import type { StatusOverviewActivityFieldsChange } from "./status-overview-activity-editor";
import type { StatusOverviewEditorSlot } from "./status-overview-editor-slot";

export interface StatusOverviewProps {
  readonly health?: ReportHealthPulse | undefined;
  readonly editorSlot?: StatusOverviewEditorSlot | undefined;
  readonly model: StatusOverviewModel;
  readonly onEditItem?:
    ((target: StatusOverviewEditTarget) => void) | undefined;
  readonly onQuickEditText?:
    ((item: StatusOverviewItem, text: string) => void) | undefined;
  readonly quickEditMemory?: StatusOverviewQuickEditMemory | undefined;
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
  readonly onResolvePlan?:
    ((item: StatusOverviewItem, focusKey?: string) => void) | undefined;
  readonly onRestorePlan?:
    ((item: StatusOverviewItem, focusKey?: string) => void) | undefined;
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
  /** Session retention so a projection change does not drop the linked draft. */
  readonly linkedMemory?: StatusOverviewLinkedMemory | undefined;
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
