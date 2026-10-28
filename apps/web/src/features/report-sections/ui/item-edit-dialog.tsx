"use client";

import { useId } from "react";

import { DialogSurface } from "../../../shared/ui/dialogs/dialog-surface";
import { DocumentBodyPortal } from "../../../shared/ui/dialogs/document-body-portal";
import { RecordDialogFooter } from "../../../shared/ui/forms/record-dialog-footer";
import type { ParentActivityOption } from "../model/record-parent";
import type { KanbanItem, Product, RiskEntry } from "../model/types";
import { ItemEditDialogFields } from "./item-edit-dialog-fields";
import { choicesForWeek } from "./item-status-choices";
import { useItemEditDialog } from "./use-item-edit-dialog";

const EMPTY_ACTIVITIES: readonly ParentActivityOption[] = [];

export interface ItemEditDialogProps {
  readonly isPending?: boolean | undefined;
  readonly open: boolean;
  // null = create (append); non-null = edit (upsert by id).
  readonly item: KanbanItem | null;
  readonly products: readonly Product[];
  // When set, parent picker offers activities; activity parent hides stage step.
  readonly activities?: readonly ParentActivityOption[] | undefined;
  readonly week: "current" | "next";
  readonly currentUserName?: string | undefined;
  // Requested product seed; a missing or stale ID leaves the parent unresolved.
  readonly defaultProductId?: string | undefined;
  // Activity seed takes precedence when both parent seeds are supplied.
  readonly defaultActivityId?: string | undefined;
  readonly stagesForProduct?:
    ((productId: string) => readonly string[]) | undefined;
  // Ranks in use this period; duplicate values violate the input contract.
  readonly ownPeriodRanks?: readonly number[] | undefined;
  // Covering risk floors status chips to a locked message (alarm is risk-derived).
  readonly risks?: readonly RiskEntry[] | undefined;
  readonly onSave: (next: KanbanItem) => void;
  readonly onSaveAndAddAnother?: ((next: KanbanItem) => void) | undefined;
  readonly onCancel: () => void;
  readonly onDelete?: (() => void) | undefined;
}

// One mounted dialog owns one draft store; remounting seeds a fresh draft.
export function ItemEditDialog({ open, ...rest }: ItemEditDialogProps) {
  if (!open) return null;
  return <ItemEditDialogContent {...rest} />;
}

type ItemEditDialogContentProps = Omit<ItemEditDialogProps, "open">;

function ItemEditDialogHeading({
  id,
  headerVerb,
  parentName,
}: {
  readonly id: string;
  readonly headerVerb: string;
  readonly parentName: string;
}) {
  return (
    <h2
      id={id}
      className="mb-4 font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]"
    >
      {headerVerb}{" "}
      {parentName ? (
        <span className="text-[var(--color-muted-foreground)]">
          — {parentName}
        </span>
      ) : null}
    </h2>
  );
}

function ItemEditDialogContent(props: ItemEditDialogContentProps) {
  const { activities = EMPTY_ACTIVITIES, products, week, onDelete } = props;
  const headingId = useId();
  const {
    dialogSurfaceRef,
    handleKeyDown,
    handleSave,
    headerVerb,
    requestClose,
    discardDialog,
    ...fields
  } = useItemEditDialog({ ...props, activities });

  return (
    <DocumentBodyPortal>
      <DialogSurface
        isPending={props.isPending}
        surfaceRef={dialogSurfaceRef}
        onDismiss={requestClose}
        onBackdropKeyDown={handleKeyDown}
        surfaceClassName="mx-4 w-full max-w-3xl rounded-[var(--radius)] bg-[var(--color-popover)] p-4 md:p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
        ariaLabelledBy={headingId}
      >
        <ItemEditDialogHeading
          id={headingId}
          headerVerb={headerVerb}
          parentName={fields.parentName}
        />

        <ItemEditDialogFields
          {...fields}
          week={week}
          products={products}
          activities={activities}
          choices={choicesForWeek(week)}
        />

        <RecordDialogFooter
          sticky
          saveLabel="Save item"
          onCancel={requestClose}
          onSave={handleSave}
          onSaveAndAddAnother={fields.handleSaveAndAddAnother}
          onDelete={onDelete}
          saveDisabled={fields.isDeadEnd}
        />
      </DialogSurface>
      {discardDialog}
    </DocumentBodyPortal>
  );
}
