"use client";

import { createPortal } from "react-dom";

import { RecordDialogFooter } from "../../../shared/ui/record-dialog-footer";
import type {
  DecisionEntry,
  ParentActivityOption,
  Product,
} from "../../report-sections";
import { DecisionEditDialogFields } from "./decision-edit-dialog-fields";
import { useDecisionEditDialog } from "./use-decision-edit-dialog";

interface DecisionEditDialogProps {
  readonly open: boolean;
  /** null = create mode, DecisionEntry = edit mode. */
  readonly decision: DecisionEntry | null;
  /**
   * Default owner for newly-created decisions. Should be the current user's
   * display name — leads usually own the decisions they raise.
   */
  readonly defaultOwner?: string;
  /**
   * SDLC stages owned on the selected product. Changing the product re-scopes
   * the decision's stage options instead of using a department-wide union.
   */
  readonly stagesForProduct?: (productId: string) => readonly string[];
  /**
   * Products assigned to the lead. Multiple products enable the picker used to
   * scope the decision.
   */
  readonly products?: readonly Product[];
  /**
   * The section author's attached activities. Choosing one as the parent hides
   * the stage step because activities, unlike products, do not own stages.
   */
  readonly activities?: readonly ParentActivityOption[];
  readonly defaultProductId?: string;
  readonly onSave: (next: DecisionEntry) => void;
  readonly onCancel: () => void;
  readonly onDelete?: () => void;
}

/**
 * The outer component unmounts the dialog content when closed. Each mount
 * initializes fresh state from props, so no reset effect or prop dependency
 * list is needed; the parent's per-open dialog key guarantees a fresh mount.
 */
export function DecisionEditDialog(props: DecisionEditDialogProps) {
  if (!props.open) return null;
  return <DecisionEditDialogContent {...props} />;
}

function DecisionEditDialogContent({
  decision,
  defaultOwner,
  stagesForProduct,
  products,
  activities = [],
  defaultProductId,
  onSave,
  onCancel,
  onDelete,
}: DecisionEditDialogProps) {
  const {
    availableStages,
    deadline,
    dialogSurfaceRef,
    handleKeyDown,
    handleSave,
    headerProductName,
    headerVerb,
    impact,
    impactError,
    impactRef,
    isActivityParent,
    isDeadEnd,
    onDeadlineChange,
    onImpactChange,
    onParentChange,
    onStageChange,
    onTextChange,
    parent,
    stageError,
    stageIds,
    text,
    textError,
    textRef,
  } = useDecisionEditDialog({
    decision,
    defaultOwner,
    stagesForProduct,
    products,
    activities,
    defaultProductId,
    onSave,
    onCancel,
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- onClick only stops propagation to the backdrop; Escape is handled by the backdrop's onKeyDown which bubbles up */}
      <div
        ref={dialogSurfaceRef}
        className="w-full max-w-3xl rounded-[var(--radius)] bg-white p-4 md:p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${headerVerb} dialog`}
      >
        <h2 className="mb-4 font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          {headerVerb}
        </h2>

        {/* The risk-dialog layout keeps prose on the left and product/stage
            classification on the right. Decisions have no status or severity. */}
        <DecisionEditDialogFields
          text={text}
          onTextChange={onTextChange}
          textError={textError}
          textRef={textRef}
          deadline={deadline}
          onDeadlineChange={onDeadlineChange}
          impact={impact}
          onImpactChange={onImpactChange}
          impactError={impactError}
          impactRef={impactRef}
          parent={parent}
          products={products ?? []}
          activities={activities}
          onParentChange={onParentChange}
          isActivityParent={isActivityParent}
          stageIds={stageIds}
          availableStages={availableStages}
          isDeadEnd={isDeadEnd}
          stageError={stageError}
          headerProductName={headerProductName}
          onStageChange={onStageChange}
        />

        <RecordDialogFooter
          saveLabel="Save Decision"
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
