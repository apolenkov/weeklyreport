"use client";

import type { KeyboardEventHandler, ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";

import { DialogSurface } from "../../../shared/ui/dialog-surface";
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
  readonly decision: DecisionEntry | null;
  readonly defaultOwner?: string | undefined;
  readonly stagesForProduct?:
    ((productId: string) => readonly string[]) | undefined;
  readonly products?: readonly Product[] | undefined;
  readonly activities?: readonly ParentActivityOption[] | undefined;
  readonly defaultProductId?: string | undefined;
  readonly onSave: (next: DecisionEntry) => void;
  readonly onCancel: () => void;
  readonly onDelete?: (() => void) | undefined;
}

// Unmounts when closed; each open remounts fresh from props (no reset effect).
export function DecisionEditDialog(props: DecisionEditDialogProps) {
  if (!props.open) return null;
  return <DecisionEditDialogContent {...props} />;
}

function DecisionDialogShell({
  surfaceRef,
  headerVerb,
  onCancel,
  onKeyDown,
  children,
}: {
  readonly surfaceRef: RefObject<HTMLDivElement | null>;
  readonly headerVerb: string;
  readonly onCancel: () => void;
  readonly onKeyDown: KeyboardEventHandler<HTMLDivElement>;
  readonly children: ReactNode;
}) {
  return (
    <DialogSurface
      surfaceRef={surfaceRef}
      onDismiss={onCancel}
      onBackdropKeyDown={onKeyDown}
      backdropClassName="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      surfaceClassName="w-full max-w-3xl rounded-[var(--radius)] bg-white p-4 md:p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
      ariaLabel={`${headerVerb} dialog`}
    >
      <h2 className="mb-4 font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
        {headerVerb}
      </h2>
      {children}
    </DialogSurface>
  );
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
  const dialog = useDecisionEditDialog({
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
    <DecisionDialogShell
      surfaceRef={dialog.dialogSurfaceRef}
      headerVerb={dialog.headerVerb}
      onCancel={onCancel}
      onKeyDown={dialog.handleKeyDown}
    >
      {/* The risk-dialog layout keeps prose on the left and product/stage
          classification on the right. Decisions have no status or severity. */}
      <DecisionEditDialogFields
        {...dialog}
        products={products ?? []}
        activities={activities}
      />

      <RecordDialogFooter
        saveLabel="Save Decision"
        onCancel={onCancel}
        onSave={dialog.handleSave}
        onDelete={onDelete}
        saveDisabled={dialog.isDeadEnd}
      />
    </DecisionDialogShell>,
    document.body,
  );
}
