"use client";

import type { KeyboardEventHandler, ReactNode, RefObject } from "react";

import { DialogSurface } from "../../../shared/ui/dialogs/dialog-surface";
import { DocumentBodyPortal } from "../../../shared/ui/dialogs/document-body-portal";
import { RecordDialogFooter } from "../../../shared/ui/forms/record-dialog-footer";
import type {
  DecisionEntry,
  ParentActivityOption,
  Product,
} from "../../report-sections";
import { DecisionEditDialogFields } from "./decision-edit-dialog-fields";
import { useDecisionEditDialog } from "./use-decision-edit-dialog";

const EMPTY_ACTIVITIES: readonly ParentActivityOption[] = [];

interface DecisionEditDialogProps {
  readonly isPending?: boolean | undefined;
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
  isPending,
  surfaceRef,
  headerVerb,
  onCancel,
  onKeyDown,
  children,
}: {
  readonly isPending?: boolean | undefined;
  readonly surfaceRef: RefObject<HTMLDivElement | null>;
  readonly headerVerb: string;
  readonly onCancel: () => void;
  readonly onKeyDown: KeyboardEventHandler<HTMLDivElement>;
  readonly children: ReactNode;
}) {
  return (
    <DialogSurface
      isPending={isPending}
      surfaceRef={surfaceRef}
      onDismiss={onCancel}
      onBackdropKeyDown={onKeyDown}
      surfaceClassName="mx-4 w-full max-w-3xl rounded-[var(--radius)] bg-[var(--color-popover)] p-4 md:p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
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
  isPending,
  decision,
  defaultOwner,
  stagesForProduct,
  products,
  activities = EMPTY_ACTIVITIES,
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

  return (
    <DocumentBodyPortal>
      <DecisionDialogShell
        isPending={isPending}
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
      </DecisionDialogShell>
    </DocumentBodyPortal>
  );
}
