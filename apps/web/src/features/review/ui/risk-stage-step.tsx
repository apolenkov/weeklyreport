"use client";

import { StageMultiSelect } from "../../report-sections/ui/stage-multi-select";
import type { RiskSeverity } from "./risk-edit-dialog-helpers";

/**
 * The product-only stage step: the multi-select (with severity preview) plus
 * the zero-owned-stage "contact admin" notice. Rendered only for a product
 * parent; an activity owns no stage.
 */
export function RiskStageStep({
  stageIds,
  availableStages,
  severity,
  isDeadEnd,
  error,
  onChange,
}: {
  readonly stageIds: string[];
  readonly availableStages: readonly string[];
  readonly severity: RiskSeverity;
  readonly isDeadEnd: boolean;
  readonly error: string | undefined;
  readonly onChange: (next: string[]) => void;
}) {
  return (
    <>
      <StageMultiSelect
        id="risk-stage"
        value={stageIds}
        stages={availableStages}
        onChange={onChange}
        previewSeverity={severity}
        // Suppress the stale required-stage error in the dead-end branch so it
        // never co-renders with the contact-admin notice below.
        error={isDeadEnd ? undefined : error}
        required
      />
      {isDeadEnd && (
        <p role="status" className="text-xs text-[var(--color-destructive)]">
          No stages assigned — contact admin.
        </p>
      )}
    </>
  );
}
