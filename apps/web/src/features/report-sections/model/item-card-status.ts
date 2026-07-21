import {
  coveringRisksForItem,
  highestAlarmSeverity,
} from "../../../lib/item-alarm";
import type { ItemStatus, KanbanItem, RiskEntry } from "./types";

interface DerivedCardStatus {
  displayStatus: ItemStatus | "at-risk";
  isBlocked: boolean;
  isPlanned: boolean;
  alarmLocked: boolean;
  /**
   * Set when the flooring covering risk belongs to ANOTHER author — the current
   * lead cannot resolve it alone, so the lock affordance names that author.
   */
  lockAuthorName?: string;
}

/**
 * The author whose foreign covering risk floors the item, or undefined — only
 * when an own risk does NOT already produce the same floor (that one the lead
 * could resolve themselves, so the generic lock copy applies).
 */
function foreignLockAuthor(
  covering: readonly RiskEntry[],
  alarm: "at-risk" | "blocked" | null,
): string | undefined {
  const own = highestAlarmSeverity(covering.filter((r) => r.foreign !== true));
  if (alarm === null || own === alarm) return undefined;
  return covering.find((r) => r.foreign === true && r.severity === alarm)
    ?.authorName;
}

/**
 * Resolve the pill the card shows. The at-risk/blocked alarm is the roll-up of
 * the covering risks (the item-card analogue of the stage-chip floor), never a
 * free item status. Product-parented items only — an activity item's severity
 * stays isolated; the in-progress gate leaves completed/planned on their
 * progress pill. A derived alarm locks the pill (resolve the covering
 * risk/blocker to change it); a co-owner's flooring risk names its author.
 */
export function deriveCardStatus(
  item: KanbanItem,
  risks: readonly RiskEntry[] | undefined,
): DerivedCardStatus {
  // No risk set threaded in, OR a foreign (cross-author) item: trust item.status
  // as-is. Foreign items are mixed into the own-item arrays but carry their
  // author's already-overlaid status (mapForeignItems) — deriving them against
  // the merged risk set would floor them against the wrong risks.
  if (risks === undefined || item.foreign === true) {
    return {
      displayStatus: item.status,
      isBlocked: item.status === "blocked",
      isPlanned: item.status === "planned",
      alarmLocked: false,
    };
  }
  // Stored `blocked` is unrepresentable: the DB CHECK and Zod reject it, and
  // workflowToItemStatus never produces it — an own item's status arrives here
  // as a pure Progress value. `blocked` appears only as the risk-derived alarm
  // below (or pre-baked on foreign rows, which returned early above).
  const covering =
    item.activityId == null && item.productId !== ""
      ? coveringRisksForItem(item, risks)
      : [];
  const derivedAlarm = highestAlarmSeverity(covering);
  const displayStatus: ItemStatus | "at-risk" = derivedAlarm ?? item.status;
  const lockAuthorName = foreignLockAuthor(covering, derivedAlarm);
  return {
    displayStatus,
    isBlocked: displayStatus === "blocked",
    isPlanned: displayStatus === "planned",
    alarmLocked: derivedAlarm !== null,
    ...(lockAuthorName ? { lockAuthorName } : {}),
  };
}
