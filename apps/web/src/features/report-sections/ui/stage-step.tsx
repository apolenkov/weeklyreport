"use client";

import type { ReactNode } from "react";

import { StageMultiSelect } from "./stage-multi-select";

interface StageStepProps {
  readonly id: string;
  readonly stageNames: string[];
  readonly availableStages: readonly string[];
  readonly isDeadEnd: boolean;
  readonly error: string | undefined;
  readonly onChange: (next: string[]) => void;
  readonly previewSeverity?: "at-risk" | "blocked";
  readonly deadEndNotice: ReactNode;
}

export function StageStep({
  id,
  stageNames,
  availableStages,
  isDeadEnd,
  error,
  onChange,
  previewSeverity,
  deadEndNotice,
}: StageStepProps) {
  return (
    <>
      <StageMultiSelect
        id={id}
        value={stageNames}
        stages={availableStages}
        error={isDeadEnd ? undefined : error}
        onChange={onChange}
        previewSeverity={previewSeverity}
        required
      />
      {isDeadEnd && (
        <p role="status" className="text-xs text-[var(--color-destructive)]">
          {deadEndNotice}
        </p>
      )}
    </>
  );
}
