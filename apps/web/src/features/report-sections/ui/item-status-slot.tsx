"use client";

import { Lock } from "lucide-react";
import type { ReactNode } from "react";

import type { ChipChoice } from "../../../shared/ui/forms/choice-chip-row";
import { ChoiceChipRow } from "../../../shared/ui/forms/choice-chip-row";
import type { ItemStatus } from "../model/types";
import type { StatusSlot } from "./item-edit-dialog-helpers";

function StatusField({ children }: { readonly children: ReactNode }) {
  return (
    <div>
      <span
        id="item-status-label"
        className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
      >
        Status
      </span>
      {children}
    </div>
  );
}

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
    <StatusField>
      <ChoiceChipRow
        choices={choices}
        value={status}
        onSelect={onSelect}
        ariaLabelledBy="item-status-label"
      />
    </StatusField>
  );
}

// Covering risk owns the alarm — free chips replaced by a read-only lock.
function CoveredStatusLock() {
  return (
    <StatusField>
      <p className="flex items-start gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-xs text-[var(--color-foreground)]">
        <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        Status is set by the covering risk/blocker — resolve it in Risks &amp;
        Blockers to change.
      </p>
    </StatusField>
  );
}

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
    <ItemStatusChips choices={choices} status={status} onSelect={onSelect} />
  );
}
