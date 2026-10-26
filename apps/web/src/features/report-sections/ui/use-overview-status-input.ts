"use client";

import type { ItemWorkflowStatus } from "@weeklyreport/shared";
import { useEffect, useRef, useState } from "react";

import { statusInputKind } from "../model/item-status";
import type { ItemStatusInput } from "../model/lead-actions/lead-item-status-patch";
import type { StatusOverviewItem } from "../model/status-overview";
import type { ActionProps } from "./status-overview-item-actions";

function useStatusFocusReturn() {
  const mounted = useRef(true);
  const frame = useRef<number | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);
  const returnFocus = (key: string | undefined) => {
    frame.current = requestAnimationFrame(() => {
      if (!mounted.current) return;
      const controls = [
        ...document.querySelectorAll<HTMLButtonElement>(
          "[data-overview-focus]",
        ),
      ].filter(
        (button) => !button.disabled && !button.closest("[hidden], [inert]"),
      );
      const identity = key?.slice(key.lastIndexOf(":") + 1);
      const target =
        controls.find((button) => button.dataset.overviewFocus === key) ??
        controls.find(
          (button) =>
            identity !== undefined &&
            button.dataset.overviewFocus?.endsWith(`:${identity}`),
        );
      target?.focus();
    });
  };
  return { mounted, returnFocus };
}
function statusFailure(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The status could not be saved. Try again.";
}
async function sendStatus(
  handler: NonNullable<ActionProps["onSetStatus"]>,
  item: StatusOverviewItem,
  status: ItemWorkflowStatus,
  context: {
    readonly focusKey: string | undefined;
    readonly input: ItemStatusInput | undefined;
  },
): Promise<unknown> {
  return context.input === undefined
    ? handler(item, status, context.focusKey)
    : handler(item, status, context.focusKey, context.input);
}

function statusLockReason(
  asking: "paused" | "done" | null,
  busy: boolean,
): string | null {
  if (asking !== null)
    return "Save or cancel the open status input before choosing another status.";
  return busy ? "Saving the status…" : null;
}

export function useOverviewStatusInput(
  item: StatusOverviewItem,
  onSetStatus: ActionProps["onSetStatus"],
) {
  const [asking, setAsking] = useState<"paused" | "done" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const origin = useRef<string | undefined>(undefined);
  const { mounted, returnFocus } = useStatusFocusReturn();
  const record = async (
    status: ItemWorkflowStatus,
    input?: ItemStatusInput,
  ) => {
    if (!onSetStatus || running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    const focusKey = origin.current;
    try {
      const result = await sendStatus(onSetStatus, item, status, {
        focusKey,
        input,
      });
      if (mounted.current) {
        if (typeof result === "string") setError(result);
        else {
          setAsking(null);
          returnFocus(focusKey);
        }
      }
    } catch (error_) {
      if (mounted.current) setError(statusFailure(error_));
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  // The status menu stays closed to new choices while an input is open or a
  // write is running; the reason is shown where the choices are.
  const lockReason = statusLockReason(asking, busy);
  return {
    asking,
    busy,
    error,
    lockReason,
    choose: (
      _item: StatusOverviewItem,
      status: ItemWorkflowStatus,
      focusKey?: string,
    ) => {
      if (running.current || item.statusRiskText || asking !== null) return;
      origin.current = focusKey;
      setError(null);
      const input = statusInputKind(item, status);
      if (input === null) void record(status);
      else setAsking(input);
    },
    pause: (pausedReason: string) => void record("paused", { pausedReason }),
    finish: () => void record("done", { nextStepAction: "clear" }),
    cancel: () => {
      if (running.current) return;
      setAsking(null);
      setError(null);
      returnFocus(origin.current);
    },
  };
}
