"use client";

import { StageMultiSelect } from "../../report-sections";

/**
 * The product-only stage step shared by the Item and Decision dialogs: the
 * multi-select plus the zero-owned-stage "contact admin" notice. An activity
 * parent owns no SDLC stage, so callers render this only for a product parent.
 */
export function RecordStageStep({
  id,
  stageIds,
  availableStages,
  isDeadEnd,
  error,
  parentName,
  onChange,
}: {
  readonly id: string;
  readonly stageIds: string[];
  readonly availableStages: readonly string[];
  readonly isDeadEnd: boolean;
  readonly error: string | undefined;
  readonly parentName: string;
  readonly onChange: (next: string[]) => void;
}) {
  return (
    <>
      <StageMultiSelect
        id={id}
        value={stageIds}
        stages={availableStages}
        required
        // Suppress the stale required-stage error in the dead-end branch so it
        // never co-renders with the contact-admin notice below.
        error={isDeadEnd ? undefined : error}
        onChange={onChange}
      />
      {isDeadEnd && (
        <p role="status" className="text-xs text-[var(--color-destructive)]">
          No stages assigned on {parentName} — contact admin.
        </p>
      )}
    </>
  );
}
