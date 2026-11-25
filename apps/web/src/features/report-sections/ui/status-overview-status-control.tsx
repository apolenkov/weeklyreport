import type { ItemWorkflowStatus } from "@weeklyreport/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@weeklyreport/ui/components/ui/dropdown-menu";
import { ArrowRight, Check, CircleHelp } from "lucide-react";
import { useId, useRef } from "react";
import { toast } from "sonner";

import { statusInputKind } from "../model/item-status";
import type { StatusOverviewItem } from "../model/status-overview";
import { statusOverviewItemActions } from "../model/status-overview-items";
import { StaticStatusIcon, StatusTrigger } from "./overview-status-trigger";
import {
  type ActionProps,
  canResolveFromStatus,
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

const currentChoices = [
  ["done", "Done"],
  ["in_progress", "In progress"],
  ["planned", "Not started"],
  ["paused", "Paused…"],
  ["postponed", "Postponed"],
] as const satisfies readonly (readonly [ItemWorkflowStatus, string])[];
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
  return currentChoices.map(([status, label]) => {
    const current = status === item.workflowStatus;
    return (
      <DropdownMenuItem
        key={status}
        aria-current={current ? "true" : undefined}
        disabled={
          locked || (Boolean(item.statusRiskText) && !(current && canConfirm))
        }
        aria-describedby={reasonIds}
        onSelect={() => onChoose(status)}
        className={MENU_ITEM_CLASS}
      >
        <ProgressIcon status={status} />
        <span className="flex-1">{label}</span>
        {current ? <Check aria-hidden="true" className="size-4" /> : null}
      </DropdownMenuItem>
    );
  });
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

// The terminal outcome is one level inside the status menu, never a second menu.
function ResolvePlanMenuItem({
  item,
  lockReason,
  onResolvePlan,
}: {
  readonly item: StatusOverviewItem;
  readonly lockReason: string | null;
  readonly onResolvePlan: ActionProps["onResolvePlan"];
}) {
  const reason =
    lockReason ??
    item.statusRiskText ??
    (!onResolvePlan || !canResolveFromStatus(item)
      ? "This record cannot be closed here."
      : undefined);
  return (
    <DropdownMenuItem
      aria-disabled={!!reason}
      title={reason}
      aria-description={reason}
      onSelect={(event) => {
        if (reason) {
          event.preventDefault();
          toast.info(reason);
        } else
          onResolvePlan?.(item, `resolve:${item.source}:${identityOf(item)}`);
      }}
      className={MENU_ITEM_CLASS}
    >
      <ProgressIcon status="wont_do" />
      Won’t do…
    </DropdownMenuItem>
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
  const reason =
    moveReason ?? (!onMoveItem ? "This record cannot be moved." : undefined);
  return (
    <DropdownMenuItem
      aria-disabled={!!reason}
      title={reason}
      aria-description={reason}
      onSelect={(event) => {
        if (reason) {
          event.preventDefault();
          toast.info(reason);
        } else onMoveItem?.(item, "next", focusKey);
      }}
    >
      <ArrowRight />
      Move to next week
    </DropdownMenuItem>
  );
}
function StatusIcon({ item }: { item: StatusOverviewItem }) {
  if (item.needsConfirmation)
    return <CircleHelp aria-hidden="true" className="size-5" />;
  return (
    <ProgressIcon status={item.resolution ? "wont_do" : item.workflowStatus} />
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
  const { riskReasonId, lockReasonId, reasonIds } = useStatusReasons(
    item,
    lockReason,
  );
  const label = statusLabelOf(item);
  const carried = item.needsConfirmation === true;
  const icon = <StatusIcon item={item} />;
  if (
    statusOverviewItemActions(item).primary !== "status" ||
    onSetStatus === undefined
  ) {
    return <StaticStatusIcon label={label}>{icon}</StaticStatusIcon>;
  }
  const focusKey = `${carried ? "confirm" : "edit"}:${item.source}:${identityOf(item)}`;
  const statusActions = {
    item,
    focusKey,
    lockReason,
    onSetStatus,
    onConfirmItem,
    inlineChoice,
  };
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
          onChoose={(status) => chooseStatus({ ...statusActions, status })}
          canConfirm={carried && onConfirmItem !== undefined}
          locked={lockReason !== null}
          reasonIds={reasonIds}
        />
        <DropdownMenuSeparator />
        <WeekMoveOption
          {...{ item, focusKey, onMoveItem }}
          moveReason={lockReason ?? moveReason}
        />
        <ResolvePlanMenuItem
          item={item}
          lockReason={lockReason}
          onResolvePlan={onResolvePlan}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function useStatusReasons(item: StatusOverviewItem, lockReason: string | null) {
  const riskReasonId = useId();
  const lockReasonId = useId();
  const reasonIds = describedByIds(
    item.statusRiskText ? riskReasonId : null,
    lockReason ? lockReasonId : null,
  );
  return { riskReasonId, lockReasonId, reasonIds };
}
