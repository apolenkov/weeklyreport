"use client";

import { createPortal } from "react-dom";

import { RecordDialogFooter } from "../../../shared/ui/record-dialog-footer";
import type {
  ParentActivityOption,
  Product,
  RiskEntry,
} from "../../report-sections";
import { RiskEditDialogFields } from "./risk-edit-dialog-fields";
import type { RiskSeverity } from "./risk-edit-dialog-helpers";
import { useRiskEditDialog } from "./use-risk-edit-dialog";

interface RiskEditDialogProps {
  readonly open: boolean;
  // null = create mode, RiskEntry = edit mode.
  readonly risk: RiskEntry | null;
  readonly products: readonly Product[];
  // When set, parent picker offers activities; activity parent hides stages.
  readonly activities?: readonly ParentActivityOption[];
  readonly onSave: (
    next: RiskEntry & { impact: string; mitigation: string },
  ) => void;
  readonly onCancel: () => void;
  readonly defaultProductId?: string;
  // Create-mode activity parent seed (XOR with product); activity pill raise.
  readonly defaultActivityId?: string;
  // Impact/mitigation are not on presentation RiskEntry but the lead-form
  // writes them onto section.risks, so the dialog returns a richer object.
  readonly initialImpact?: string;
  readonly initialMitigation?: string;
  // Chip-raise create prefill; ignored in edit mode (risk values win).
  readonly initialStageIds?: string[];
  readonly initialSeverity?: RiskSeverity;
  // Owned stages for the stage select; [] disables Save with a dead-end notice.
  readonly stagesForProduct?: (productId: string) => readonly string[];
  readonly onDelete?: () => void;
}

// Mount/unmount shell: closed returns null so open remounts fresh useState
// (parent openSeq dialogKey forces a clean snapshot of stagesForProduct).
export function RiskEditDialog(props: RiskEditDialogProps) {
  if (!props.open) return null;
  return <RiskEditDialogContent {...props} />;
}

// Flagged owned stages for product parents only (activities own no stage).
function PreCheckedStagesBanner({
  parentName,
  preCheckedStages,
}: {
  readonly parentName: string;
  readonly preCheckedStages: readonly {
    name: string;
    severity: RiskSeverity;
  }[];
}) {
  return (
    <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
      <div className="font-medium text-amber-900">
        {parentName} →{" "}
        {preCheckedStages
          .map(
            (s) =>
              `${s.name} (${s.severity === "blocked" ? "Blocked" : "At Risk"})`,
          )
          .join(" · ")}
      </div>
      <div className="mt-0.5 text-[11px] text-amber-700">
        Already flagged in SDLC pipeline.
      </div>
    </div>
  );
}

function RiskEditDialogContent({
  risk,
  products,
  onSave,
  onCancel,
  defaultProductId,
  defaultActivityId,
  initialImpact,
  initialMitigation,
  initialStageIds,
  initialSeverity,
  stagesForProduct,
  activities = [],
  onDelete,
}: RiskEditDialogProps) {
  const {
    availableStages,
    dialogSurfaceRef,
    handleKeyDown,
    handleSave,
    headerVerb,
    impact,
    impactError,
    impactRef,
    isActivityParent,
    isDeadEnd,
    mitigation,
    mitigationError,
    mitigationRef,
    onImpactChange,
    onMitigationChange,
    onParentChange,
    onSeveritySelect,
    onStageChange,
    onTextChange,
    parent,
    parentName,
    preCheckedStages,
    severity,
    stageError,
    stageIds,
    text,
    textError,
    textRef,
  } = useRiskEditDialog({
    risk,
    products,
    activities,
    onSave,
    onCancel,
    defaultProductId,
    defaultActivityId,
    initialImpact,
    initialMitigation,
    initialStageIds,
    initialSeverity,
    stagesForProduct,
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- onClick only stops backdrop click-through; not an interactive action, so no keyboard equivalent applies */}
      <div
        ref={dialogSurfaceRef}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[var(--radius)] bg-white p-4 md:p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${headerVerb} dialog`}
      >
        <h2 className="mb-4 font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          {headerVerb}{" "}
          {parentName ? (
            <span className="text-[var(--color-muted-foreground)]">
              — {parentName}
            </span>
          ) : null}
        </h2>

        {!isActivityParent && preCheckedStages.length > 0 && (
          <PreCheckedStagesBanner
            parentName={parentName}
            preCheckedStages={preCheckedStages}
          />
        )}

        <RiskEditDialogFields
          text={text}
          onTextChange={onTextChange}
          textError={textError}
          textRef={textRef}
          impact={impact}
          onImpactChange={onImpactChange}
          impactError={impactError}
          impactRef={impactRef}
          mitigation={mitigation}
          onMitigationChange={onMitigationChange}
          mitigationError={mitigationError}
          mitigationRef={mitigationRef}
          parent={parent}
          products={products}
          activities={activities}
          onParentChange={onParentChange}
          isActivityParent={isActivityParent}
          stageIds={stageIds}
          availableStages={availableStages}
          severity={severity}
          isZeroOwnedStageDeadEnd={isDeadEnd}
          stageError={stageError}
          onStageChange={onStageChange}
          onSeveritySelect={onSeveritySelect}
        />

        <RecordDialogFooter
          sticky
          saveLabel="Save Risk"
          onCancel={onCancel}
          onSave={handleSave}
          onDelete={onDelete}
          saveDisabled={isDeadEnd}
        />
      </div>
    </div>,
    document.body,
  );
}
