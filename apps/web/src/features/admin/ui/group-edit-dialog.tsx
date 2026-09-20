"use client";

import { shortName } from "@customreport/shared";
import { useRef } from "react";

import { useDialogFocus } from "../../../shared/hooks/dialogs/use-dialog-focus";
import { DialogSurface } from "../../../shared/ui/dialogs/dialog-surface";
import type {
  AdminGroupView,
  AdminProductView,
  AdminUserView,
} from "../model/admin-types";
import type { GroupFormData } from "../model/group-form";
import { AdminEntityDialogActions } from "./admin-entity-dialog-actions";
import { GroupProductsEditor } from "./group-products-editor";

interface GroupEditDialogProps {
  readonly editingGroup: AdminGroupView | null;
  readonly form: GroupFormData;
  readonly onFormChange: (form: GroupFormData) => void;
  readonly headCandidates: readonly AdminUserView[];
  readonly products: readonly AdminProductView[];
  readonly canSave: boolean;
  readonly isSaving: boolean;
  readonly onSave: () => void;
  readonly onClose: () => void;
}

const FIELD_LABEL_CLASS =
  "mb-1 block text-sm font-medium text-[var(--color-foreground)]";
const FIELD_CONTROL_CLASS =
  "w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]";

// Every field edits one key of the same immutable form value.
type GroupFieldProps = Pick<GroupEditDialogProps, "form" | "onFormChange">;

function GroupNameField({ form, onFormChange }: GroupFieldProps) {
  return (
    <div>
      <label htmlFor="group-name" className={FIELD_LABEL_CLASS}>
        Name
      </label>
      <input
        id="group-name"
        type="text"
        name="groupName"
        autoComplete="off"
        required
        value={form.name}
        onChange={(e) => onFormChange({ ...form, name: e.target.value })}
        className={FIELD_CONTROL_CLASS}
      />
    </div>
  );
}

function GroupDescriptionField({ form, onFormChange }: GroupFieldProps) {
  return (
    <div>
      <label htmlFor="group-description" className={FIELD_LABEL_CLASS}>
        Description
      </label>
      <textarea
        id="group-description"
        name="groupDescription"
        autoComplete="off"
        value={form.description}
        onChange={(e) => onFormChange({ ...form, description: e.target.value })}
        rows={3}
        className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
      />
    </div>
  );
}

function GroupLeaderField({
  form,
  onFormChange,
  headCandidates,
}: GroupFieldProps & Pick<GroupEditDialogProps, "headCandidates">) {
  return (
    <div>
      <label htmlFor="group-leader" className={FIELD_LABEL_CLASS}>
        Leader
      </label>
      <select
        id="group-leader"
        name="headUserId"
        autoComplete="off"
        value={form.headUserId}
        onChange={(e) => onFormChange({ ...form, headUserId: e.target.value })}
        className={FIELD_CONTROL_CLASS}
      >
        <option value="">— No leader —</option>
        {headCandidates.map((u) => (
          <option key={u.id} value={u.id}>
            {shortName(u)} ({u.email})
          </option>
        ))}
      </select>
      {headCandidates.length === 0 && (
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          No users with role &lsquo;head&rsquo; or &lsquo;admin&rsquo;
          available.
        </p>
      )}
    </div>
  );
}

// Only offered when editing: a brand-new group is never born archived.
function GroupArchivedField({ form, onFormChange }: GroupFieldProps) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="archived"
          checked={form.archived}
          onChange={(e) =>
            onFormChange({ ...form, archived: e.target.checked })
          }
          className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-starbucks-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <span className="block text-sm">
          <span className="font-medium text-[var(--color-foreground)]">
            Archived
          </span>
          <span className="mt-0.5 block text-xs text-[var(--color-muted-foreground)]">
            Hidden from new user/group pickers; existing references keep
            working.
          </span>
        </span>
      </label>
    </div>
  );
}

function GroupFormFields({
  form,
  onFormChange,
  headCandidates,
  products,
  editingGroup,
  isSaving,
}: Pick<
  GroupEditDialogProps,
  | "form"
  | "onFormChange"
  | "headCandidates"
  | "products"
  | "editingGroup"
  | "isSaving"
>) {
  return (
    <fieldset
      disabled={isSaving}
      aria-label="Group fields"
      className="mt-4 min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto pr-1"
      data-testid="group-dialog-body"
    >
      <GroupNameField form={form} onFormChange={onFormChange} />
      <GroupDescriptionField form={form} onFormChange={onFormChange} />
      <GroupLeaderField
        form={form}
        onFormChange={onFormChange}
        headCandidates={headCandidates}
      />
      {editingGroup && (
        <GroupArchivedField form={form} onFormChange={onFormChange} />
      )}
      {editingGroup && (
        <GroupProductsEditor groupId={editingGroup.id} products={products} />
      )}
    </fieldset>
  );
}

export function GroupEditDialog(props: GroupEditDialogProps) {
  const { editingGroup, isSaving, onClose } = props;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const closeIfIdle = () => {
    if (!isSaving) onClose();
  };

  // Focus trap + Escape-to-close + restore-to-trigger via the shared primitive.
  // The dialog mounts on open, so the hook self-captures the opener at first
  // render and restores focus to it on close.
  useDialogFocus({
    open: true,
    onClose: closeIfIdle,
    containerRef: surfaceRef,
  });

  return (
    <DialogSurface
      surfaceRef={surfaceRef}
      onDismiss={closeIfIdle}
      surfaceClassName="animate-scale-in mx-4 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-xl"
      ariaLabel={editingGroup ? "Edit group" : "Add group"}
      testId="crud-sheet"
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          if (!isSaving && props.canSave) props.onSave();
        }}
      >
        <h3 className="shrink-0 font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          {editingGroup ? "Edit Group" : "Add Group"}
        </h3>
        <GroupFormFields
          form={props.form}
          onFormChange={props.onFormChange}
          headCandidates={props.headCandidates}
          products={props.products}
          editingGroup={editingGroup}
          isSaving={isSaving}
        />
        <AdminEntityDialogActions
          saveLabel={editingGroup ? "Save Changes" : "Add Group"}
          canSave={props.canSave}
          isSaving={isSaving}
          onClose={closeIfIdle}
          saveButtonAttributes={{
            "data-interaction-effect": "mutation-required",
          }}
        />
      </form>
    </DialogSurface>
  );
}
