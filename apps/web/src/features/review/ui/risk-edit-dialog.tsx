"use client";

import { createPortal } from "react-dom";

import { DialogSurface } from "../../../shared/ui/dialog-surface";
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
  readonly activities?: readonly ParentActivityOption[] | undefined;
  readonly onSave: (
    next: RiskEntry & { impact: string; mitigation: string },
  ) => void;
  readonly onCancel: () => void;
  readonly defaultProductId?: string | undefined;
  // Create-mode activity parent seed (XOR with product); activity pill raise.
  readonly defaultActivityId?: string | undefined;
  // Impact/mitigation are not on presentation RiskEntry but the lead-form
  // writes them onto section.risks, so the dialog returns a richer object.
  readonly initialImpact?: string | undefined;
  readonly initialMitigation?: string | undefined;
  // Chip-raise create prefill; ignored in edit mode (risk values win).
  readonly initialStageNames?: string[] | undefined;
  readonly initialSeverity?: RiskSeverity | undefined;
  // Owned stages for the stage select; [] disables Save with a dead-end notice.
  readonly stagesForProduct?:
    ((productId: string) => readonly string[]) | undefined;
  readonly onDelete?: (() => void) | undefined;
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

type RiskDialog = ReturnType<typeof useRiskEditDialog>;
type RiskFieldRefs = Pick<
  RiskDialog,
  "textRef" | "impactRef" | "mitigationRef"
>;
// Refs travel as their own props: a presentational part that received them
// inside a bag would be reading a ref during render.
type RiskDialogState = Omit<
  RiskDialog,
  keyof RiskFieldRefs | "dialogSurfaceRef"
>;

interface RiskDialogBodyProps extends RiskFieldRefs {
  readonly dialog: RiskDialogState;
  readonly products: readonly Product[];
  readonly activities: readonly ParentActivityOption[];
}

function RiskDialogBody({
  dialog,
  products,
  activities,
  textRef,
  impactRef,
  mitigationRef,
}: RiskDialogBodyProps) {
  return (
    <>
      {!dialog.isActivityParent && dialog.preCheckedStages.length > 0 && (
        <PreCheckedStagesBanner
          parentName={dialog.parentName}
          preCheckedStages={dialog.preCheckedStages}
        />
      )}

      <RiskEditDialogFields
        text={dialog.text}
        onTextChange={dialog.onTextChange}
        textError={dialog.textError}
        textRef={textRef}
        impact={dialog.impact}
        onImpactChange={dialog.onImpactChange}
        impactError={dialog.impactError}
        impactRef={impactRef}
        mitigation={dialog.mitigation}
        onMitigationChange={dialog.onMitigationChange}
        mitigationError={dialog.mitigationError}
        mitigationRef={mitigationRef}
        parent={dialog.parent}
        products={products}
        activities={activities}
        onParentChange={dialog.onParentChange}
        isActivityParent={dialog.isActivityParent}
        stageNames={dialog.stageNames}
        availableStages={dialog.availableStages}
        severity={dialog.severity}
        isZeroOwnedStageDeadEnd={dialog.isDeadEnd}
        stageError={dialog.stageError}
        onStageChange={dialog.onStageChange}
        onSeveritySelect={dialog.onSeveritySelect}
      />
    </>
  );
}

interface RiskDialogSurfaceProps {
  readonly dialog: RiskDialogState;
  readonly surfaceRef: RiskDialog["dialogSurfaceRef"];
  readonly onCancel: () => void;
  readonly onDelete?: (() => void) | undefined;
  readonly children: React.ReactNode;
}

function RiskDialogSurface({
  dialog,
  surfaceRef,
  onCancel,
  onDelete,
  children,
}: RiskDialogSurfaceProps) {
  return (
    <DialogSurface
      surfaceRef={surfaceRef}
      onDismiss={onCancel}
      onBackdropKeyDown={dialog.handleKeyDown}
      backdropClassName="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      surfaceClassName="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[var(--radius)] bg-white p-4 md:p-5 shadow-2xl"
      ariaLabel={`${dialog.headerVerb} dialog`}
    >
      <h2 className="mb-4 font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
        {dialog.headerVerb}{" "}
        {dialog.parentName ? (
          <span className="text-[var(--color-muted-foreground)]">
            — {dialog.parentName}
          </span>
        ) : null}
      </h2>

      {children}

      <RecordDialogFooter
        sticky
        saveLabel="Save Risk"
        onCancel={onCancel}
        onSave={dialog.handleSave}
        onDelete={onDelete}
        saveDisabled={dialog.isDeadEnd}
      />
    </DialogSurface>
  );
}

function RiskEditDialogContent(props: RiskEditDialogProps) {
  const activities = props.activities ?? [];
  const { dialogSurfaceRef, textRef, impactRef, mitigationRef, ...dialog } =
    useRiskEditDialog({
      risk: props.risk,
      products: props.products,
      activities,
      onSave: props.onSave,
      onCancel: props.onCancel,
      defaultProductId: props.defaultProductId,
      defaultActivityId: props.defaultActivityId,
      initialImpact: props.initialImpact,
      initialMitigation: props.initialMitigation,
      initialStageNames: props.initialStageNames,
      initialSeverity: props.initialSeverity,
      stagesForProduct: props.stagesForProduct,
    });

  return createPortal(
    <RiskDialogSurface
      dialog={dialog}
      surfaceRef={dialogSurfaceRef}
      onCancel={props.onCancel}
      onDelete={props.onDelete}
    >
      <RiskDialogBody
        dialog={dialog}
        products={props.products}
        activities={activities}
        textRef={textRef}
        impactRef={impactRef}
        mitigationRef={mitigationRef}
      />
    </RiskDialogSurface>,
    document.body,
  );
}
