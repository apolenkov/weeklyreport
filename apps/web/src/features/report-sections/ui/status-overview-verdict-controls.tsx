"use client";

import { SAFE_TEXT_MAX_LENGTH } from "@weeklyreport/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@weeklyreport/ui/components/ui/dropdown-menu";
import { Ellipsis } from "lucide-react";
import { type SubmitEvent, useEffect, useRef, useState } from "react";

import type { StatusOverviewItem } from "../model/status-overview";
import type { PlanVerdict } from "../model/status-overview-verdict";
import {
  ICON_BUTTON_CLASS,
  identityOf,
  MENU_ITEM_CLASS,
} from "./status-overview-item-actions";
import type { VerdictHandler } from "./status-overview-item-handlers";
import { VerdictIcon } from "./status-overview-item-icons";

const VERDICT_LABEL: Readonly<Record<PlanVerdict, string>> = {
  done: "Done",
  continue: "Continue",
  next: "Next week",
  paused: "Paused",
  wont_do: "Won't do",
};

const RAIL_VERDICTS = ["done", "continue", "next", "paused"] as const;
type ReasonVerdict = "paused" | "wont_do";

const REASON_PROMPT: Readonly<Record<ReasonVerdict, string>> = {
  paused: "Pause reason",
  wont_do: "Reason",
};

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";

/** Accepted verdict, shown on the frozen prior row without touching its text. */
export function VerdictStamp({ verdict }: { readonly verdict: PlanVerdict }) {
  const label = VERDICT_LABEL[verdict];
  return (
    <span
      role="img"
      tabIndex={-1}
      data-verdict-stamp={verdict}
      aria-label={`Verdict: ${label}`}
      title={label}
      className={`inline-flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] shrink-0 items-center justify-center rounded-[var(--radius-sm)] ${FOCUS_RING}`}
    >
      <VerdictIcon verdict={verdict} />
    </span>
  );
}

function ReasonRow({
  verdict,
  item,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  readonly verdict: ReasonVerdict;
  readonly item: StatusOverviewItem;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onSubmit: (reason: string) => void;
  readonly onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [missing, setMissing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const errorId = `verdict-error-${identityOf(item)}`;
  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (reason.trim() === "") {
      setMissing(true);
      return;
    }
    onSubmit(reason);
  };
  const message = missing ? "Add a one-line reason." : error;
  return (
    <form onSubmit={submit} className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <input
          ref={input}
          type="text"
          value={reason}
          maxLength={SAFE_TEXT_MAX_LENGTH}
          disabled={busy}
          aria-label={`${VERDICT_LABEL[verdict]} reason — ${item.text}`}
          aria-invalid={message !== null}
          aria-describedby={message === null ? undefined : errorId}
          placeholder={REASON_PROMPT[verdict]}
          onChange={(event) => {
            setReason(event.target.value);
            setMissing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") onCancel();
          }}
          className={`min-h-[var(--touch-target-min)] min-w-0 basis-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-card)] px-2 text-sm ${FOCUS_RING}`}
        />
        <button
          type="submit"
          disabled={busy}
          className={`min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] px-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50 ${FOCUS_RING}`}
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] px-2 text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)] ${FOCUS_RING}`}
        >
          Cancel
        </button>
      </div>
      {message === null ? null : (
        <p
          id={errorId}
          role="alert"
          className="text-xs text-[var(--color-destructive)]"
        >
          {message}
        </p>
      )}
    </form>
  );
}

function WontDoMenu({
  item,
  disabled,
  onChoose,
}: {
  readonly item: StatusOverviewItem;
  readonly disabled: boolean;
  readonly onChoose: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={`More actions for ${item.text}`}
          title="More actions"
          data-verdict="wont_do"
          className={`${ICON_BUTTON_CLASS} disabled:opacity-50`}
        >
          <Ellipsis aria-hidden="true" className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          aria-label={`${VERDICT_LABEL.wont_do} — ${item.text}`}
          onSelect={onChoose}
          className={MENU_ITEM_CLASS}
        >
          <VerdictIcon verdict="wont_do" />
          {VERDICT_LABEL.wont_do}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
    <div
      ref={rail}
      role="group"
      aria-label={`Verdict for ${item.text}`}
      className="flex flex-wrap items-center"
    >
      {RAIL_VERDICTS.map((verdict) => (
        <button
          key={verdict}
          type="button"
          disabled={busy}
          aria-label={`${VERDICT_LABEL[verdict]} — ${item.text}`}
          title={VERDICT_LABEL[verdict]}
          data-verdict={verdict}
          onClick={() => onChoose(verdict)}
          className={`${ICON_BUTTON_CLASS} disabled:opacity-50`}
        >
          <VerdictIcon verdict={verdict} />
        </button>
      ))}
      <WontDoMenu
        item={item}
        disabled={busy}
        onChoose={() => onChoose("wont_do")}
      />
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
    const opener = cancelled.current;
    cancelled.current = null;
    rail.current
      ?.querySelectorAll<HTMLElement>("[data-verdict]")
      .forEach((button) => {
        if (button.dataset.verdict === opener) button.focus();
      });
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
  const cancel = () => {
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
        verdict={asking}
        item={item}
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
