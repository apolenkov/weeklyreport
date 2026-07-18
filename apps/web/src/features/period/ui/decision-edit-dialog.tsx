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
   * unify-record-dialogs: SDLC stages owned on the SELECTED product. A decision
   * is now product-scoped like an item/risk — changing the product re-scopes its
   * stage options (it no longer draws from the department-wide union).
   */
  readonly stagesForProduct?: (productId: string) => readonly string[];
  /**
   * R4-B: products the lead is assigned to. When more than one, the dialog
   * shows a product picker so the lead can scope the decision to a product.
   */
  readonly products?: readonly Product[];
  /**
   * activity-first-class: the section author's attached activities. When
   * non-empty the parent picker offers them; choosing an activity hides the
   * stage step and parents the decision to the activity instead of a product
   * (Decision 0.4 — parity with the item/risk dialogs).
   */
  readonly activities?: readonly ParentActivityOption[];
  readonly defaultProductId?: string;
  readonly onSave: (next: DecisionEntry) => void;
  readonly onCancel: () => void;
  readonly onDelete?: () => void;
}

/**
 * D12 mount/unmount shell (react-compiler-safe): the outer component returns
 * null when closed and mounts the inner content otherwise. Mount = fresh
 * useState from props; close = unmount. No useEffect reset is needed — the
 * remount is the structural reset, and the parent's openSeq dialogKey forces
 * a fresh mount on every open. This makes the A13 invariant (products /
 * stagesForProduct never read in any deps array) structural.
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

        {/* unify-record-dialogs: two-column layout mirroring the risk dialog —
            prose on the left, a CLASSIFICATION panel (Product + Stages) on the
            right. A decision carries no status/severity, so the panel is leaner. */}
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
