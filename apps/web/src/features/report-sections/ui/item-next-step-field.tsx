"use client";

import { SAFE_TEXT_MAX_LENGTH } from "@customreport/shared";
import type { RefObject } from "react";

import { RecordTextareaField } from "../../../shared/ui/forms/record-textarea-field";
import type { ItemStatus } from "../model/types";

interface NextStepFieldProps {
  readonly value: string;
  readonly error: string | undefined;
  readonly status: ItemStatus;
  readonly onChange: (next: string) => void;
  readonly textareaRef?: RefObject<HTMLTextAreaElement | null> | undefined;
}

const PAUSED_NOTICE_ID = "item-next-step-paused-notice";

// A next step is a separate carry-over commitment, never a rewrite of the
// current-period result in Description.
export function NextStepField({
  value,
  error,
  status,
  onChange,
  textareaRef,
}: NextStepFieldProps) {
  const isPaused = status === "paused";
  return (
    <RecordTextareaField
      id="item-next-step"
      label="Next step (optional)"
      value={value}
      onChange={onChange}
      error={error}
      placeholder="Describe the next concrete step…"
      minHeightPx={52}
      textareaRef={textareaRef}
      characterLimit={SAFE_TEXT_MAX_LENGTH}
      describedBy={isPaused ? PAUSED_NOTICE_ID : undefined}
      fill={false}
      hint={
        <>
          <p className="mb-1 text-xs text-[var(--color-muted-foreground)]">
            What should carry forward after this update?
          </p>
          {isPaused ? (
            <p
              id={PAUSED_NOTICE_ID}
              role="status"
              className="mb-1 text-xs text-[var(--color-muted-foreground)]"
            >
              This plan is retained, but carry-over is suspended until you
              resume this item.
            </p>
          ) : null}
        </>
      }
    />
  );
}
