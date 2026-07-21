"use client";

import type { Ref } from "react";

import { ChoiceChipRow } from "../../../shared/ui/choice-chip-row";
import { RecordTextareaField } from "../../../shared/ui/record-textarea-field";
import type {
  ParentActivityOption,
  Product,
  RecordParent,
} from "../../report-sections";
import { ParentPicker, StageStep } from "../../report-sections";
import type { RiskSeverity } from "./risk-edit-dialog-helpers";
import { SEVERITY_CHOICES } from "./risk-severity-choices";

interface RiskEditDialogFieldsProps {
  readonly text: string;
  readonly onTextChange: (value: string) => void;
  readonly textError: string | undefined;
  readonly textRef: Ref<HTMLTextAreaElement>;
  readonly impact: string;
  readonly onImpactChange: (value: string) => void;
  readonly impactError: string | undefined;
  readonly impactRef: Ref<HTMLTextAreaElement>;
  readonly mitigation: string;
  readonly onMitigationChange: (value: string) => void;
  readonly mitigationError: string | undefined;
  readonly mitigationRef: Ref<HTMLTextAreaElement>;
  readonly parent: RecordParent;
  readonly products: readonly Product[];
  readonly activities: readonly ParentActivityOption[];
  readonly onParentChange: (next: RecordParent) => void;
  readonly isActivityParent: boolean;
  readonly stageIds: string[];
  readonly availableStages: readonly string[];
  readonly severity: RiskSeverity;
  readonly isZeroOwnedStageDeadEnd: boolean;
  readonly stageError: string | undefined;
  readonly onStageChange: (next: string[]) => void;
  readonly onSeveritySelect: (value: RiskSeverity) => void;
}

/**
 * The risk dialog's two-column form body: the Risk/Impact/Mitigation prose on
 * the left, the Parent/Stage/Severity classification panel on the right.
 * Balanced two-column layout: a moderate max-w-3xl grid that collapses to one
 * column on a narrow modal (md: breakpoint). The prose textareas use flex-1 to
 * absorb height up to the taller (bordered) panel, so the two columns finish at
 * a comparable height with no stray space.
 */
export function RiskEditDialogFields({
  text,
  onTextChange,
  textError,
  textRef,
  impact,
  onImpactChange,
  impactError,
  impactRef,
  mitigation,
  onMitigationChange,
  mitigationError,
  mitigationRef,
  parent,
  products,
  activities,
  onParentChange,
  isActivityParent,
  stageIds,
  availableStages,
  severity,
  isZeroOwnedStageDeadEnd,
  stageError,
  onStageChange,
  onSeveritySelect,
}: RiskEditDialogFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-stretch">
      {/* Left column: Risk / Impact / Mitigation prose fields. flex-col so
          the textareas can flex-1 and fill the column to the panel height. */}
      <div className="flex flex-1 flex-col gap-4">
        <RecordTextareaField
          id="risk-text"
          label="Risk"
          required
          value={text}
          onChange={onTextChange}
          error={textError}
          placeholder="e.g. Vendor API regression delays OAuth2 integration"
          minHeightPx={60}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- forwarded to RecordTextareaField, which owns the actual DOM autofocus and its own justification
          autoFocus
          textareaRef={textRef}
        />
        <RecordTextareaField
          id="risk-impact"
          label="Impact"
          required
          value={impact}
          onChange={onImpactChange}
          error={impactError}
          placeholder="e.g. Delays Q3 launch by 2 weeks; 4 downstream teams idle"
          minHeightPx={50}
          textareaRef={impactRef}
        />
        <RecordTextareaField
          id="risk-mitigation"
          label="Mitigation"
          required
          value={mitigation}
          onChange={onMitigationChange}
          error={mitigationError}
          placeholder="e.g. Vendor escalation in progress; ETA 48h"
          minHeightPx={50}
          textareaRef={mitigationRef}
        />
      </div>

      {/* Classification: the right column — one light bordered panel
          grouping the stage / severity / product meta so it reads as a
          distinct block beside the prose fields. */}
      <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
        <span className="block text-xs font-semibold tracking-wide text-[var(--color-muted-foreground)] uppercase">
          Classification
        </span>

        {/* Parent picker kept FIRST so the classification panel orders
            Parent → Stages → Severity, the same order as the item dialog.
            Offers products and the author's attached activities; choosing an
            activity hides the stage step below. */}
        <ParentPicker
          id="risk-product"
          value={parent}
          products={products}
          activities={activities}
          onChange={onParentChange}
        />

        {/* The stage step is product-only. */}
        {!isActivityParent && (
          <StageStep
            id="risk-stage"
            stageIds={stageIds}
            availableStages={availableStages}
            previewSeverity={severity}
            isDeadEnd={isZeroOwnedStageDeadEnd}
            error={stageError}
            deadEndNotice="No stages assigned — contact admin."
            onChange={onStageChange}
          />
        )}

        {/* Severity chips */}
        <div>
          <span className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]">
            Severity
          </span>
          <p className="mb-1 text-[11px] text-[var(--color-muted-foreground)]">
            <strong>At Risk</strong> = needs attention; <strong>Blocked</strong>{" "}
            = work stopped.
          </p>
          <ChoiceChipRow
            choices={SEVERITY_CHOICES}
            value={severity}
            onSelect={onSeveritySelect}
          />
        </div>
      </div>
    </div>
  );
}
