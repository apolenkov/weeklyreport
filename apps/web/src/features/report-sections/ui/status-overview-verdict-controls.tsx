"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@weeklyreport/ui/components/ui/dropdown-menu";
import { CircleHelp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { StatusOverviewItem } from "../model/status-overview";
import { planOutcomeId } from "../model/status-overview-lineage";
import type { PlanVerdict } from "../model/status-overview-verdict";
import {
  ICON_BUTTON_CLASS,
  MENU_ITEM_CLASS,
} from "./status-overview-item-actions";
import type { VerdictHandler } from "./status-overview-item-handlers";
import { VerdictIcon } from "./status-overview-item-icons";
import { ReasonRow } from "./status-overview-reason-row";

const VERDICT_LABEL: Readonly<Record<PlanVerdict, string>> = {
  done: "Done",
  continue: "In progress",
  next: "Next week",
  paused: "Paused…",
  wont_do: "Won’t do…",
};

type ReasonVerdict = "paused" | "wont_do";

const REASON_PROMPT: Readonly<Record<ReasonVerdict, string>> = {
  paused: "Pause reason",
  wont_do: "Reason",
};

function VerdictButtons({
  item,
  busy,
  rail,
  onChoose,
}: {
  readonly item: StatusOverviewItem;
  readonly busy: boolean;
  readonly rail: React.RefObject<HTMLDivElement | null>;
  readonly onChoose: (verdict: PlanVerdict) => void;
}) {
  return (
    <div ref={rail}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={busy}
            id={planOutcomeId(item)}
            data-plan-outcome=""
            aria-label={`Choose outcome: ${item.text}. Planned last week, no outcome yet`}
            title="Planned last week — choose what happened"
            className={ICON_BUTTON_CLASS}
          >
            <CircleHelp aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {(Object.keys(VERDICT_LABEL) as PlanVerdict[]).map((verdict) => (
            <DropdownMenuItem
              key={verdict}
              className={MENU_ITEM_CLASS}
              onSelect={() => onChoose(verdict)}
            >
              <VerdictIcon verdict={verdict} />
              {VERDICT_LABEL[verdict]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
function useVerdictFlow(
  item: StatusOverviewItem,
  onVerdict: VerdictHandler,
  onDecided: () => void,
) {
  const [asking, setAsking] = useState<ReasonVerdict | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rail = useRef<HTMLDivElement>(null);
  const cancelled = useRef<ReasonVerdict | null>(null);
  // Cancelling swaps the reason row back for the rail: focus returns to the
  // control that opened it instead of dropping to the page.
  useEffect(() => {
    if (asking !== null || cancelled.current === null) return;
    cancelled.current = null;
    rail.current?.querySelector("button")?.focus();
  }, [asking]);
  const record = async (verdict: PlanVerdict, reason?: string) => {
    setBusy(true);
    setError(null);
    const failure = await onVerdict(item, verdict, reason);
    setBusy(false);
    if (failure === null) onDecided();
    else setError(failure);
  };
  const choose = (verdict: PlanVerdict) => {
    if (verdict === "paused" || verdict === "wont_do") {
      setError(null);
      setAsking(verdict);
    } else void record(verdict);
  };
  const cancel = (value = "") => {
    if (value.trim()) {
      rail.current?.querySelector("input")?.focus();
      return;
    }
    cancelled.current = asking;
    setAsking(null);
    setError(null);
  };
  return { asking, busy, error, rail, record, choose, cancel };
}

/**
 * One-action verdict for a prior-week item still awaiting a decision. Paused
 * and Won't do ask for a one-line reason first. The rail is always visible: it
 * is the item's pending work, not a secondary action.
 */
export function VerdictRail({
  item,
  onVerdict,
  onDecided,
}: {
  readonly item: StatusOverviewItem;
  readonly onVerdict: VerdictHandler;
  readonly onDecided: () => void;
}) {
  const flow = useVerdictFlow(item, onVerdict, onDecided);
  const { asking, busy, error } = flow;
  if (asking !== null)
    return (
      <ReasonRow
        label={`${VERDICT_LABEL[asking]} reason — ${item.text}`}
        placeholder={REASON_PROMPT[asking]}
        busy={busy}
        error={error}
        onSubmit={(reason) => void flow.record(asking, reason)}
        onCancel={flow.cancel}
      />
    );
  return (
    <div className="min-w-0">
      <VerdictButtons
        item={item}
        busy={busy}
        rail={flow.rail}
        onChoose={flow.choose}
      />
      {error === null ? null : (
        <p role="alert" className="text-xs text-[var(--color-destructive)]">
          {error}
        </p>
      )}
    </div>
  );
}
