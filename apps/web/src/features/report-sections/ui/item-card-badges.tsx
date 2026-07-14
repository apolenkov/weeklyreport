import { PublishedRecordMarker } from "../../period";
import type { StatusBadge } from "../model/item-card-style";

interface ItemCardBadgesProps {
  readonly badge: StatusBadge;
  readonly alarmLocked: boolean;
  readonly lockAuthorName: string | undefined;
  readonly priorityRank: number | null | undefined;
  readonly publishedLocked: boolean;
}

/**
 * The item card's top-left badge cluster: the status pill, an optional
 * priority-rank pill, and the published-record marker. Presentational only —
 * the status/lock derivation stays on the card.
 */
export function ItemCardBadges({
  badge,
  alarmLocked,
  lockAuthorName,
  priorityRank,
  publishedLocked,
}: ItemCardBadgesProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
      <span
        className="inline-flex w-fit shrink-0 items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[10px] font-semibold"
        style={{ background: badge.bg, color: badge.text }}
        title={
          alarmLocked
            ? lockAuthorName
              ? `Status is set by ${lockAuthorName}'s covering risk/blocker — resolve it with them to change.`
              : "Status is set by the covering risk/blocker — resolve it to change."
            : undefined
        }
      >
        {badge.label}
      </span>
      {priorityRank != null && (
        <span
          role="img"
          className="inline-flex w-fit shrink-0 items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-bold tabular-nums"
          style={{
            background: "var(--color-starbucks-gold)",
            color: "var(--color-primary-foreground)",
          }}
          aria-label={`Priority ${priorityRank}`}
          title={`Priority rank ${priorityRank}`}
        >
          P{priorityRank}
        </span>
      )}
      {publishedLocked && <PublishedRecordMarker />}
    </div>
  );
}
