import {
  coveringRisksForItem,
  highestAlarmSeverity,
} from "./alarms/item-alarm";
import type {
  ItemStatus,
  KanbanItem,
  ProductKanbanItem,
  RiskEntry,
} from "./types";

function isProductItem(item: KanbanItem): item is ProductKanbanItem {
  return item.parent.kind === "product";
}

interface DerivedCardStatus {
  displayStatus: ItemStatus;
  isBlocked: boolean;
  isPlanned: boolean;
  alarmLocked: boolean;
  // Set when the flooring covering risk is another author's — lock copy names them.
  lockAuthorName?: string;
}

// Author of the foreign covering risk that floors the item, or undefined when
// an own risk already produces the same floor (generic lock copy applies).
function foreignLockAuthor(
  covering: readonly RiskEntry[],
  alarm: "at-risk" | "blocked" | null,
): string | undefined {
  const own = highestAlarmSeverity(covering.filter((r) => r.foreign !== true));
  if (alarm === null || own === alarm) return undefined;
  return covering.find((r) => r.foreign === true && r.severity === alarm)
    ?.authorName;
}

// Pill from covering-risk roll-up (not free status). Activity items stay
// isolated; completed/planned keep progress. Foreign flooring risk names author.
export function deriveCardStatus(
  item: KanbanItem,
  risks: readonly RiskEntry[] | undefined,
): DerivedCardStatus {
  // No risks, or foreign item: trust item.status (already overlaid by author).
  // Deriving foreign rows against the merged set would floor against wrong risks.
  if (risks === undefined || item.foreign === true) {
    return {
      displayStatus: item.status,
      isBlocked: item.status === "blocked",
      isPlanned: item.status === "planned",
      alarmLocked: false,
    };
  }
  if (!isProductItem(item)) {
    return {
      displayStatus: item.status,
      isBlocked: item.status === "blocked",
      isPlanned: item.status === "planned",
      alarmLocked: false,
    };
  }
  // Stored `blocked` is unrepresentable (DB/Zod reject it); own items arrive as
  // pure Progress. `blocked` appears only as the risk-derived alarm below.
  const covering = coveringRisksForItem(item, risks);
  const derivedAlarm = highestAlarmSeverity(covering);
  const displayStatus: ItemStatus = derivedAlarm ?? item.status;
  const lockAuthorName = foreignLockAuthor(covering, derivedAlarm);
  return {
    displayStatus,
    isBlocked: displayStatus === "blocked",
    isPlanned: displayStatus === "planned",
    alarmLocked: derivedAlarm !== null,
    ...(lockAuthorName ? { lockAuthorName } : {}),
  };
}
