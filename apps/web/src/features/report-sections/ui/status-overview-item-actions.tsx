import type { ItemWorkflowStatus } from "@weeklyreport/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@weeklyreport/ui/components/ui/dropdown-menu";
import { Check } from "lucide-react";
import { useRef } from "react";

import { itemStatusToWorkflow } from "../model/item-status";
import type { ItemStatusInput } from "../model/lead-actions/lead-item-status-patch";
import type {
  StatusOverviewEditTarget,
  StatusOverviewItem,
} from "../model/status-overview";
import { statusOverviewItemActions } from "../model/status-overview-items";
import { choicesForWeek } from "./item-status-choices";
import type { VerdictHandler } from "./status-overview-item-handlers";
import { ProgressIcon } from "./status-overview-item-icons";
import { statusOverviewProgressLabel } from "./status-overview-item-metadata";

export interface ActionProps {
  readonly item: StatusOverviewItem;
  readonly onEditItem?:
    ((target: StatusOverviewEditTarget) => void) | undefined;
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
        input?: ItemStatusInput,
      ) => void | Promise<string | null>)
    | undefined;
  readonly onResolvePlan?:
    ((item: StatusOverviewItem, focusKey?: string) => void) | undefined;
  readonly onRestorePlan?:
    ((item: StatusOverviewItem, focusKey?: string) => void) | undefined;
  readonly onVerdict?: VerdictHandler | undefined;
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";
export const ICON_BUTTON_CLASS = `inline-flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] ${FOCUS_RING}`;
export const MENU_ITEM_CLASS = "min-h-[var(--touch-target-min)] cursor-pointer";
export function identityOf(item: StatusOverviewItem): string {
  return item.stableId ?? item.key;
}

function StatusMenuItems({
  item,
  onChoose,
}: {
  readonly item: StatusOverviewItem;
  readonly onChoose: (status: ItemWorkflowStatus) => void;
}) {
  return choicesForWeek(item.source === "next" ? "next" : "current").map(
    (choice) => {
      const status = itemStatusToWorkflow(choice.value);
      const current = status === item.workflowStatus;
      return (
        <DropdownMenuItem
          key={choice.value}
          aria-current={current ? "true" : undefined}
          disabled={Boolean(item.statusRiskText)}
          onSelect={() => {
            if (!item.statusRiskText) onChoose(status);
          }}
          className={MENU_ITEM_CLASS}
        >
          <ProgressIcon status={status} />
          <span className="flex-1">{choice.label}</span>
          {current ? <Check aria-hidden="true" className="size-4" /> : null}
        </DropdownMenuItem>
      );
    },
  );
}

/**
 * The status icon is the one primary interaction: it opens a menu of statuses
 * (a cycling click would pass over statuses that need a reason). Where no
 * status can be written it stays a plain, non-interactive image.
 */
export function StatusControl({
  item,
  onSetStatus,
  onConfirmItem,
}: Pick<ActionProps, "item" | "onSetStatus" | "onConfirmItem">) {
  const inlineChoice = useRef(false);
  const unplanned = item.continuity === "unplanned" ? " · Unplanned" : "";
  const label = `Status of ${item.text}: ${statusOverviewProgressLabel(item)}${unplanned}`;
  const carried = item.needsConfirmation === true;
  const icon = (
    <ProgressIcon
      status={item.resolution ? "wont_do" : item.workflowStatus}
      unconfirmed={carried}
    />
  );
  if (
    statusOverviewItemActions(item).primary !== "status" ||
    onSetStatus === undefined
  ) {
    return (
      <span
        role="img"
        aria-label={label}
        className="inline-flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] items-center justify-center"
      >
        {icon}
      </span>
    );
  }
  const focusKey = `${carried ? "confirm" : "edit"}:${item.source}:${identityOf(item)}`;
  // Choosing the status a carried item already shows is the confirmation.
  const choose = (status: ItemWorkflowStatus) => {
    if (item.statusRiskText) return;
    if (carried && status === item.workflowStatus && onConfirmItem) {
      onConfirmItem(item);
      return;
    }
    inlineChoice.current =
      status === "paused" ||
      (status === "done" && Boolean(item.nextStepText?.trim()));
    void onSetStatus(item, status, focusKey);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          // The submit-readiness summary deep-links to this id and focus key.
          id={carried ? focusKey : undefined}
          type="button"
          aria-label={label}
          title={label}
          data-overview-focus={focusKey}
          className={ICON_BUTTON_CLASS}
        >
          {icon}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onCloseAutoFocus={(event) => {
          if (inlineChoice.current) event.preventDefault();
          inlineChoice.current = false;
        }}
        className="max-w-[min(24rem,calc(100vw-2rem))]"
      >
        {item.statusRiskText ? (
          <p
            data-testid="overview-status-risk-reason"
            className="px-2 py-1 text-xs text-[var(--color-muted-foreground)] break-words"
          >
            Set by risk: {item.statusRiskText} — resolve it in Risks &amp;
            Blockers
          </p>
        ) : null}
        <StatusMenuItems item={item} onChoose={choose} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
