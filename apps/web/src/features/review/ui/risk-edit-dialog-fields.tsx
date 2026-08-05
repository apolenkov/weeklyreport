"use client";

import type { Ref } from "react";

import { ChoiceChipRow } from "../../../shared/ui/forms/choice-chip-row";
import { RecordTextareaField } from "../../../shared/ui/forms/record-textarea-field";
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
  readonly stageNames: string[];
  readonly availableStages: readonly string[];
  readonly severity: RiskSeverity;
  readonly isZeroOwnedStageDeadEnd: boolean;
  readonly stageError: string | undefined;
  readonly onStageChange: (next: string[]) => void;
  readonly onSeveritySelect: (value: RiskSeverity) => void;
}

// Textarea heights: the risk statement gets one extra line over its two
// follow-ups, which are typically one sentence each.
const RISK_TEXT_MIN_HEIGHT_PX = 60;
const RISK_FOLLOW_UP_MIN_HEIGHT_PX = 50;

type RiskProseColumnProps = Pick<
  RiskEditDialogFieldsProps,
  | "text"
  | "onTextChange"
  | "textError"
  | "textRef"
  | "impact"
  | "onImpactChange"
  | "impactError"
  | "impactRef"
  | "mitigation"
  | "onMitigationChange"
  | "mitigationError"
  | "mitigationRef"
>;

// Risk → Impact → Mitigation, the order a reader needs them.
function RiskProseColumn(props: RiskProseColumnProps) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <RecordTextareaField
        id="risk-text"
        label="Risk"
        required
        value={props.text}
        onChange={props.onTextChange}
        error={props.textError}
        placeholder="e.g. Vendor API regression delays OAuth2 integration"
        minHeightPx={RISK_TEXT_MIN_HEIGHT_PX}
        focusOnMount
        textareaRef={props.textRef}
      />
      <RecordTextareaField
        id="risk-impact"
        label="Impact"
        required
        value={props.impact}
        onChange={props.onImpactChange}
        error={props.impactError}
        placeholder="e.g. Delays Q3 launch by 2 weeks; 4 downstream teams idle"
        minHeightPx={RISK_FOLLOW_UP_MIN_HEIGHT_PX}
        textareaRef={props.impactRef}
      />
      <RecordTextareaField
        id="risk-mitigation"
        label="Mitigation"
        required
        value={props.mitigation}
        onChange={props.onMitigationChange}
        error={props.mitigationError}
        placeholder="e.g. Vendor escalation in progress; ETA 48h"
        minHeightPx={RISK_FOLLOW_UP_MIN_HEIGHT_PX}
        textareaRef={props.mitigationRef}
      />
    </div>
  );
}

type RiskClassificationPanelProps = Pick<
  RiskEditDialogFieldsProps,
  | "parent"
  | "products"
  | "activities"
  | "onParentChange"
  | "isActivityParent"
  | "stageNames"
  | "availableStages"
  | "severity"
  | "isZeroOwnedStageDeadEnd"
  | "stageError"
  | "onStageChange"
  | "onSeveritySelect"
>;

function RiskClassificationPanel(props: RiskClassificationPanelProps) {
  return (
    <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
      <span className="block text-xs font-semibold tracking-wide text-[var(--color-muted-foreground)] uppercase">
        Classification
      </span>

      {/* Parent first (same order as the item dialog); activity hides stages. */}
      <ParentPicker
        id="risk-product"
        value={props.parent}
        products={props.products}
        activities={props.activities}
        onChange={props.onParentChange}
      />

      {!props.isActivityParent && (
        <StageStep
          id="risk-stage"
          stageNames={props.stageNames}
          availableStages={props.availableStages}
          previewSeverity={props.severity}
          isDeadEnd={props.isZeroOwnedStageDeadEnd}
          error={props.stageError}
          deadEndNotice="No stages assigned — contact admin."
          onChange={(next) => props.onStageChange([...next])}
        />
      )}

      <SeverityChoice
        severity={props.severity}
        onSeveritySelect={props.onSeveritySelect}
      />
    </div>
  );
}

function SeverityChoice({
  severity,
  onSeveritySelect,
}: Pick<RiskEditDialogFieldsProps, "severity" | "onSeveritySelect">) {
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]">
        Severity
      </span>
      <p className="mb-1 text-[11px] text-[var(--color-muted-foreground)]">
        <strong>At Risk</strong> = needs attention; <strong>Blocked</strong> =
        work stopped.
      </p>
      <ChoiceChipRow
        choices={SEVERITY_CHOICES}
        value={severity}
        onSelect={onSeveritySelect}
      />
    </div>
  );
}

export function RiskEditDialogFields(props: RiskEditDialogFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-stretch">
      <RiskProseColumn {...props} />
      <RiskClassificationPanel {...props} />
    </div>
  );
}
