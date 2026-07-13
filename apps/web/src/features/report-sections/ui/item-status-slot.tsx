"use client";

import type { ChipChoice } from "../../../shared/ui/choice-chip-row";
import { ChoiceChipRow } from "../../../shared/ui/choice-chip-row";
import type { ItemStatus } from "../model/types";
import type { StatusSlot } from "./item-edit-dialog-helpers";

/** The item status-chip row (Completed / In Progress / Blocked / Planned). */
function ItemStatusChips({
  choices,
  status,
  onSelect,
}: {
  readonly choices: readonly ChipChoice<ItemStatus>[];
  readonly status: ItemStatus;
  readonly onSelect: (value: ItemStatus) => void;
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]">
        Status
      </span>
      <ChoiceChipRow choices={choices} value={status} onSelect={onSelect} />
    </div>
  );
}

/**
 * The status slot when a covering risk floors the item: the alarm is derived
 * from that risk, so the free chips are replaced by a read-only lock message.
 */
function CoveredStatusLock() {
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]">
        Status
      </span>
      <p className="rounded-xl border border-[rgba(200,32,20,0.15)] bg-[var(--color-status-blocked-bg)] px-3 py-2 text-xs text-[var(--color-foreground)]">
        Status is set by the covering risk/blocker — resolve it in Risks &amp;
        Blockers to change.
      </p>
    </div>
  );
}

/** The status slot: the locked message, or the progress chips. The former
 * in-dialog "mark as blocked" gesture is gone — blockers live in Risks &
 * Blockers (rework-item-status-model). */
export function StatusSlotView({
  slot,
  choices,
  status,
  onSelect,
}: {
  readonly slot: StatusSlot;
  readonly choices: readonly ChipChoice<ItemStatus>[];
  readonly status: ItemStatus;
  readonly onSelect: (value: ItemStatus) => void;
}) {
  if (slot === "locked") return <CoveredStatusLock />;
  return (
    <div className="flex flex-col">
      <ItemStatusChips choices={choices} status={status} onSelect={onSelect} />
    </div>
  );
}
