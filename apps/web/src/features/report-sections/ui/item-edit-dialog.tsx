"use client";

import { DialogSurface } from "../../../shared/ui/dialogs/dialog-surface";
import { DocumentBodyPortal } from "../../../shared/ui/dialogs/document-body-portal";
import { RecordDialogFooter } from "../../../shared/ui/forms/record-dialog-footer";
import type { KanbanItem, Product, RiskEntry } from "../model/types";
import { ItemEditDialogFields } from "./item-edit-dialog-fields";
import { CURRENT_WEEK_CHOICES, NEXT_WEEK_CHOICES } from "./item-status-choices";
import type { ParentActivityOption } from "./parent-picker";
import { useItemEditDialog } from "./use-item-edit-dialog";

const EMPTY_ACTIVITIES: readonly ParentActivityOption[] = [];

interface ItemEditDialogProps {
  readonly open: boolean;
  // null = create (append); non-null = edit (upsert by id).
  readonly item: KanbanItem | null;
  readonly products: readonly Product[];
  // When set, parent picker offers activities; activity parent hides stage step.
  readonly activities?: readonly ParentActivityOption[] | undefined;
  // Next week omits Completed/Blocked — those are in-flight, not yet-to-start.
  readonly week: "current" | "next";
  readonly currentUserName?: string | undefined;
  // Preselect column product; without it create would misleadingly use products[0].
  readonly defaultProductId?: string | undefined;
  // Activity-lane create; XOR with defaultProductId.
  readonly defaultActivityId?: string | undefined;
  readonly stagesForProduct?:
    ((productId: string) => readonly string[]) | undefined;
  // Ranks in use this period (own item's rank excluded). Collisions stay visible, never crash.
  readonly ownPeriodRanks?: readonly number[] | undefined;
  // Covering risk floors status chips to a locked message (alarm is risk-derived).
  readonly risks?: readonly RiskEntry[] | undefined;
  readonly onSave: (next: KanbanItem) => void;
  readonly onCancel: () => void;
  readonly onDelete?: (() => void) | undefined;
}

// Mount/unmount resets state (react-compiler-safe). stagesForProduct is not in
// deps — useState seeds once from the mount snapshot so parent re-renders
// with a new stagesForProduct ref never wipe typed text.
export function ItemEditDialog({ open, ...rest }: ItemEditDialogProps) {
  if (!open) return null;
  return <ItemEditDialogContent {...rest} />;
}

type ItemEditDialogContentProps = Omit<ItemEditDialogProps, "open">;

function ItemEditDialogHeading({
  headerVerb,
  parentName,
}: {
  readonly headerVerb: string;
  readonly parentName: string;
}) {
  return (
    <h2 className="mb-4 font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
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
  const {
    activities = EMPTY_ACTIVITIES,
    products,
    week,
    onCancel,
    onDelete,
  } = props;
  const { dialogSurfaceRef, handleKeyDown, handleSave, headerVerb, ...fields } =
    useItemEditDialog({ ...props, activities });

  const choices = week === "current" ? CURRENT_WEEK_CHOICES : NEXT_WEEK_CHOICES;

  return (
    <DocumentBodyPortal>
      <DialogSurface
        surfaceRef={dialogSurfaceRef}
        onDismiss={onCancel}
        onBackdropKeyDown={handleKeyDown}
        surfaceClassName="mx-4 w-full max-w-3xl rounded-[var(--radius)] bg-[var(--color-popover)] p-4 md:p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
        ariaLabel={`${headerVerb} dialog`}
      >
        <ItemEditDialogHeading
          headerVerb={headerVerb}
          parentName={fields.parentName}
        />

        <ItemEditDialogFields
          {...fields}
          week={week}
          products={products}
          activities={activities}
          choices={choices}
        />

        <RecordDialogFooter
          saveLabel="Save Item"
          onCancel={onCancel}
          onSave={handleSave}
          onDelete={onDelete}
          saveDisabled={fields.isDeadEnd}
        />
      </DialogSurface>
    </DocumentBodyPortal>
  );
}
