import type { ItemWorkflowStatus } from "@weeklyreport/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@weeklyreport/ui/components/ui/dropdown-menu";
import { ArrowRight, Check } from "lucide-react";
import { type ReactNode, useId, useRef } from "react";
import { toast } from "sonner";

import { shortItemLabel } from "../../../shared/lib/format/short-label";
import { itemStatusToWorkflow, statusInputKind } from "../model/item-status";
import type { StatusOverviewItem } from "../model/status-overview";
import { statusOverviewItemActions } from "../model/status-overview-items";
import { choicesForWeek } from "./item-status-choices";
import {
  type ActionProps,
  canResolveFromStatus,
  ICON_BUTTON_CLASS,
  identityOf,
  MENU_ITEM_CLASS,
} from "./status-overview-item-actions";
import { ProgressIcon } from "./status-overview-item-icons";
import { statusOverviewProgressLabel } from "./status-overview-item-metadata";

function statusLabelOf(item: StatusOverviewItem): string {
  if (item.needsConfirmation) return "Status not set";
  const unplanned = item.continuity === "unplanned" ? " · Unplanned" : "";
  return `Choose outcome: ${item.text}. Status: ${statusOverviewProgressLabel(item)}${unplanned}`;
}

function StatusMenuItems({
  item,
  onChoose,
  canConfirm,
  locked,
  reasonIds,
}: {
  readonly item: StatusOverviewItem;
  readonly onChoose: (status: ItemWorkflowStatus) => void;
  readonly canConfirm: boolean;
  readonly locked: boolean;
  readonly reasonIds: string | undefined;
}) {
  return choicesForWeek(item.source === "next" ? "next" : "current").map(
    (choice) => {
      const status = itemStatusToWorkflow(choice.value);
      const current = status === item.workflowStatus;
      return (
        <DropdownMenuItem
          key={choice.value}
          aria-current={current ? "true" : undefined}
          disabled={
            locked || (Boolean(item.statusRiskText) && !(current && canConfirm))
          }
          aria-describedby={reasonIds}
          onSelect={() => onChoose(status)}
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

function RiskStatusReason({
  id,
  text,
}: {
  readonly id: string;
  readonly text: string | null | undefined;
}) {
  return text ? (
    <p
      id={id}
      data-testid="overview-status-risk-reason"
      className="px-2 py-1 text-xs text-[var(--color-muted-foreground)] break-words"
    >
      Set by risk: {text} — resolve it in Risks &amp; Blockers
    </p>
  ) : null;
}

function describedByIds(
  ...ids: readonly (string | null)[]
): string | undefined {
  return ids.filter((id) => id !== null).join(" ") || undefined;
}

function StaticStatusIcon({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className="inline-flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] items-center justify-center"
    >
      {children}
    </span>
  );
}

function StatusLockReason({
  id,
  text,
}: {
  readonly id: string;
  readonly text: string | null | undefined;
}) {
  return text ? (
    <p
      id={id}
      data-testid="overview-status-lock-reason"
      className="px-2 py-1 text-xs text-[var(--color-muted-foreground)] break-words"
    >
      {text}
    </p>
  ) : null;
}

// Choosing the status a carried item already shows is the confirmation.
function chooseStatus({
  item,
  status,
  focusKey,
  lockReason,
  onSetStatus,
  onConfirmItem,
  inlineChoice,
}: {
  readonly item: StatusOverviewItem;
  readonly status: ItemWorkflowStatus;
  readonly focusKey: string;
  readonly lockReason: string | null;
  readonly onSetStatus: ActionProps["onSetStatus"];
  readonly onConfirmItem: ActionProps["onConfirmItem"];
  readonly inlineChoice: { current: boolean };
}): void {
  if (
    item.needsConfirmation === true &&
    status === item.workflowStatus &&
    onConfirmItem
  ) {
    onConfirmItem(item);
    return;
  }
  if (item.statusRiskText || lockReason) return;
  inlineChoice.current = statusInputKind(item, status) !== null;
  void onSetStatus?.(item, status, focusKey);
}

function StatusTrigger({
  id,
  label,
  focusKey,
  children,
}: {
  readonly id: string | undefined;
  readonly label: string;
  readonly focusKey: string;
  readonly children: ReactNode;
}) {
  return (
    <DropdownMenuTrigger asChild>
      <button
        // The submit-readiness summary deep-links to this id and focus key.
        id={id}
        type="button"
        aria-label={label}
        title={label}
        data-overview-focus={focusKey}
        className={ICON_BUTTON_CLASS}
      >
        {children}
      </button>
    </DropdownMenuTrigger>
  );
}

// The terminal outcome is one level inside the status menu, never a second menu.
function ResolvePlanMenuItem({
  item,
  locked,
  onResolvePlan,
}: {
  readonly item: StatusOverviewItem;
  readonly locked: boolean;
  readonly onResolvePlan: ActionProps["onResolvePlan"];
}) {
  if (!onResolvePlan || !canResolveFromStatus(item)) return null;
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        aria-label={`Resolve plan: ${shortItemLabel(item.text)}`}
        disabled={locked}
        onSelect={() =>
          onResolvePlan(item, `resolve:${item.source}:${identityOf(item)}`)
        }
        className={MENU_ITEM_CLASS}
      >
        <span className="flex-1">Won’t do…</span>
      </DropdownMenuItem>
    </>
  );
}

function WeekMoveOption({
  item,
  moveReason,
  focusKey,
  onMoveItem,
}: Pick<ActionProps, "item" | "onMoveItem"> & {
  focusKey: string;
  moveReason: string | undefined;
}) {
  return (
    <>
      {onMoveItem && (
        <DropdownMenuItem
          aria-disabled={!!moveReason}
          title={moveReason}
          aria-description={moveReason}
          onSelect={() => {
            if (moveReason) toast.info(moveReason);
            else onMoveItem(item, "next", focusKey);
          }}
        >
          <ArrowRight />
          Move to next week
        </DropdownMenuItem>
      )}
    </>
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
  onResolvePlan,
  onMoveItem,
  moveReason,
  lockReason = null,
}: Pick<
  ActionProps,
  "item" | "onSetStatus" | "onConfirmItem" | "onResolvePlan" | "onMoveItem"
> & {
  /** While set, every choice is inactive and this is shown as the reason. */
  readonly moveReason?: string | undefined;
  readonly lockReason?: string | null;
}) {
  const inlineChoice = useRef(false);
  const riskReasonId = useId();
  const lockReasonId = useId();
  const reasonIds = describedByIds(
    item.statusRiskText ? riskReasonId : null,
    lockReason ? lockReasonId : null,
  );
  const label = statusLabelOf(item);
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
    return <StaticStatusIcon label={label}>{icon}</StaticStatusIcon>;
  }
  const focusKey = `${carried ? "confirm" : "edit"}:${item.source}:${identityOf(item)}`;
  const choose = (status: ItemWorkflowStatus) =>
    chooseStatus({
      item,
      status,
      focusKey,
      lockReason,
      onSetStatus,
      onConfirmItem,
      inlineChoice,
    });
  return (
    <DropdownMenu>
      <StatusTrigger
        id={carried ? focusKey : undefined}
        label={label}
        focusKey={focusKey}
      >
        {icon}
      </StatusTrigger>
      <DropdownMenuContent
        align="start"
        aria-describedby={reasonIds}
        onCloseAutoFocus={(event) => {
          if (inlineChoice.current) event.preventDefault();
          inlineChoice.current = false;
        }}
        className="max-w-[min(24rem,calc(100vw-2rem))]"
      >
        <RiskStatusReason id={riskReasonId} text={item.statusRiskText} />
        <StatusLockReason id={lockReasonId} text={lockReason} />
        <StatusMenuItems
          item={item}
          onChoose={choose}
          canConfirm={carried && onConfirmItem !== undefined}
          locked={lockReason !== null}
          reasonIds={reasonIds}
        />
        <WeekMoveOption {...{ item, moveReason, focusKey, onMoveItem }} />
        <ResolvePlanMenuItem
          item={item}
          locked={lockReason !== null}
          onResolvePlan={onResolvePlan}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
