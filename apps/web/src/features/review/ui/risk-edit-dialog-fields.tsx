"use client";

import { SAFE_TEXT_MAX_LENGTH } from "@weeklyreport/shared";
import { type RefObject, useId } from "react";

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
  // Dialog-scoped id prefix so two co-mounted editors never share labels,
  // textarea names or the derived -error/-limit/-hint description ids.
  readonly idPrefix: string;
  readonly text: string;
  readonly onTextChange: (value: string) => void;
  readonly textError: string | undefined;
  readonly textRef: RefObject<HTMLTextAreaElement | null>;
  readonly impact: string;
  readonly onImpactChange: (value: string) => void;
  readonly impactError: string | undefined;
  readonly impactRef: RefObject<HTMLTextAreaElement | null>;
  readonly mitigation: string;
  readonly onMitigationChange: (value: string) => void;
  readonly mitigationError: string | undefined;
  readonly mitigationRef: RefObject<HTMLTextAreaElement | null>;
  readonly parent: RecordParent;
  readonly parentError: string | undefined;
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
  | "idPrefix"
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
        id={`${props.idPrefix}-risk-text`}
        label="Risk"
        required
        value={props.text}
        onChange={props.onTextChange}
        error={props.textError}
        placeholder="e.g. Vendor API regression delays OAuth2 integration…"
        minHeightPx={RISK_TEXT_MIN_HEIGHT_PX}
        focusOnMount
        textareaRef={props.textRef}
        characterLimit={SAFE_TEXT_MAX_LENGTH}
      />
      <RecordTextareaField
        id={`${props.idPrefix}-risk-impact`}
        label="Impact"
        required
        value={props.impact}
        onChange={props.onImpactChange}
        error={props.impactError}
        placeholder="e.g. Delays Q3 launch by 2 weeks; 4 downstream teams idle…"
        minHeightPx={RISK_FOLLOW_UP_MIN_HEIGHT_PX}
        textareaRef={props.impactRef}
        characterLimit={SAFE_TEXT_MAX_LENGTH}
      />
      <RecordTextareaField
        id={`${props.idPrefix}-risk-mitigation`}
        label="Mitigation"
        required
        value={props.mitigation}
        onChange={props.onMitigationChange}
        error={props.mitigationError}
        placeholder="e.g. Vendor escalation in progress; ETA 48h…"
        minHeightPx={RISK_FOLLOW_UP_MIN_HEIGHT_PX}
        textareaRef={props.mitigationRef}
        characterLimit={SAFE_TEXT_MAX_LENGTH}
      />
    </div>
  );
}

type RiskClassificationPanelProps = Pick<
  RiskEditDialogFieldsProps,
  | "idPrefix"
  | "parent"
  | "parentError"
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
        id={`${props.idPrefix}-risk-product`}
        value={props.parent}
        error={props.parentError}
        products={props.products}
        activities={props.activities}
        onChange={props.onParentChange}
      />

      {!props.isActivityParent && (
        <StageStep
          id={`${props.idPrefix}-risk-stage`}
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
  const labelId = useId();
  const hintId = useId();

  return (
    <div>
      <span
        id={labelId}
        className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
      >
        Severity
      </span>
      <p
        id={hintId}
        className="mb-1 text-xs text-[var(--color-muted-foreground)]"
      >
        <strong>At risk</strong> = needs attention; <strong>Blocked</strong> =
        work stopped.
      </p>
      <ChoiceChipRow
        choices={SEVERITY_CHOICES}
        value={severity}
        onSelect={onSeveritySelect}
        ariaLabelledBy={labelId}
        ariaDescribedBy={hintId}
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
