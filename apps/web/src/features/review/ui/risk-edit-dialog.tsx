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
  /** null = create mode, RiskEntry = edit mode. */
  readonly risk: RiskEntry | null;
  readonly products: readonly Product[];
  /**
   * activity-first-class: the section author's attached activities. When
   * non-empty the parent picker offers them; choosing an activity hides the
   * stage step and parents the risk to the activity instead of a product.
   */
  readonly activities?: readonly ParentActivityOption[];
  readonly onSave: (
    next: RiskEntry & { impact: string; mitigation: string },
  ) => void;
  readonly onCancel: () => void;
  readonly defaultProductId?: string;
  /**
   * In create mode, preselect this activity as the parent — an activity
   * pill's unbacked raise. Wins over the seed product (XOR parent).
   */
  readonly defaultActivityId?: string;
  /**
   * The mockup-aligned dialog also exposes raw `impact` and `mitigation`
   * fields. The presentation `RiskEntry` doesn't carry them, but the
   * caller (lead-form) needs to write them onto the raw section.risks
   * row, so we let the dialog produce a richer object than the read
   * model.
   */
  readonly initialImpact?: string;
  readonly initialMitigation?: string;
  /**
   * unify-risk-stage-status: create-mode prefill from a chip-raise
   * interception — the clicked stage arrives pre-checked and the clicked
   * severity pre-selected. Ignored in edit mode (the risk's own values win).
   */
  readonly initialStageIds?: string[];
  readonly initialSeverity?: RiskSeverity;
  /**
   * Callback returning the SDLC stages the current lead owns on a given
   * project (= options for the "SDLC Stage" select). Returning `[]` disables
   * the Save button and surfaces an inline "no stages assigned — contact admin"
   * message.
   */
  readonly stagesForProduct?: (productId: string) => readonly string[];
  readonly onDelete?: () => void;
}

/**
 * Mount/unmount shell (react-compiler-safe): the outer component returns null
 * when closed and mounts the inner content otherwise. Mount = fresh useState
 * from props; close = unmount. No useEffect reset is needed — the remount is the
 * structural reset, and the parent's openSeq dialogKey forces a fresh mount on
 * every open. That gives stagesForProduct a fresh useState snapshot on each
 * mount, so its value at open time matters rather than reactive re-reads.
 */
export function RiskEditDialog(props: RiskEditDialogProps) {
  if (!props.open) return null;
  return <RiskEditDialogContent {...props} />;
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

        {/* Context strip: flagged owned SDLC stages — product parents only. An
            activity owns no stage, so suppress it there (preCheckedStages derives
            from the mount-time seed product and does not clear on a parent switch). */}
        {!isActivityParent && preCheckedStages.length > 0 && (
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
