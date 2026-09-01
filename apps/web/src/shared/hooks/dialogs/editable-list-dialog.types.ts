export type EditableListDialogState<TEntity> =
  | { open: false }
  | {
      open: true;
      mode: "create";
      seedProductId?: string;
      seedActivityId?: string;
    }
  | { open: true; mode: "edit"; entity: TEntity };

// Product and activity are mutually exclusive: a product column's "+ Add"
// seeds one, an activity lane's "+ Add" the other.
export interface CreateSeed {
  readonly productId?: string | undefined;
  readonly activityId?: string | undefined;
}

export interface UseEditableListDialogResult<TEntity> {
  readonly dialogState: EditableListDialogState<TEntity>;
  // openSeq-derived remount key. Repeated opens of the same entity always
  // remount the dialog with fresh state.
  readonly dialogKey: string;
  // The three openers below no-op when readOnly.
  readonly openCreate: (seed?: CreateSeed) => void;
  readonly openEdit: (entity: TEntity) => void;
  readonly close: () => void;
  readonly pendingDelete: TEntity | null;
  readonly requestDelete: (entity: TEntity) => void;
  readonly clearPendingDelete: () => void;
}
