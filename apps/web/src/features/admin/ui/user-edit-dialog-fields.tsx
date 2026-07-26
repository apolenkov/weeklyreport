"use client";

import type { DbRole } from "@customreport/shared";

import type { MockGroup } from "../model/admin-types";
import type { UserFormData } from "../model/user-form";

const LABEL_CLASS =
  "mb-1 block text-sm font-medium text-[var(--color-foreground)]";

const CONTROL_CLASS =
  "w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]";

interface FormBinding {
  readonly form: UserFormData;
  readonly onFormChange: (form: UserFormData) => void;
}

function TextField({
  id,
  label,
  type = "text",
  value,
  onChange,
  initialFocus = false,
}: {
  readonly id: string;
  readonly label: string;
  readonly type?: "text" | "email";
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly initialFocus?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional initial focus for this modal dialog
        autoFocus={initialFocus}
        className={CONTROL_CLASS}
      />
    </div>
  );
}

function IdentityFields({ form, onFormChange }: FormBinding) {
  return (
    <>
      <TextField
        id="user-last-name"
        label="Last name"
        value={form.lastName}
        onChange={(lastName) => onFormChange({ ...form, lastName })}
        initialFocus
      />
      <TextField
        id="user-first-name"
        label="First name"
        value={form.firstName}
        onChange={(firstName) => onFormChange({ ...form, firstName })}
      />
      <TextField
        id="user-middle-name"
        label="Middle name"
        value={form.middleName}
        onChange={(middleName) => onFormChange({ ...form, middleName })}
      />
      <TextField
        id="user-position"
        label="Position"
        value={form.position}
        onChange={(position) => onFormChange({ ...form, position })}
      />
      <TextField
        id="user-email"
        label="Email"
        type="email"
        value={form.email}
        onChange={(email) => onFormChange({ ...form, email })}
      />
    </>
  );
}

// A viewer owns no group; any other role keeps its group or falls back to the
// first configured one, so the form never submits an unowned non-viewer.
function withRole(
  form: UserFormData,
  role: DbRole,
  activeGroups: readonly MockGroup[],
  groups: readonly MockGroup[],
): UserFormData {
  return {
    ...form,
    role,
    groupId:
      role === "viewer"
        ? ""
        : form.groupId || activeGroups[0]?.id || groups[0]?.id || "",
  };
}

function RoleField({
  form,
  onFormChange,
  activeGroups,
  groups,
}: FormBinding & {
  readonly activeGroups: readonly MockGroup[];
  readonly groups: readonly MockGroup[];
}) {
  return (
    <div>
      <label htmlFor="user-role" className={LABEL_CLASS}>
        Role
      </label>
      <select
        id="user-role"
        value={form.role}
        onChange={(e) =>
          onFormChange(
            withRole(form, e.target.value as DbRole, activeGroups, groups),
          )
        }
        className={CONTROL_CLASS}
      >
        <option value="lead">Lead</option>
        <option value="head">Head</option>
        <option value="admin">Admin</option>
        <option value="viewer">Viewer</option>
      </select>
    </div>
  );
}

function GroupField({
  form,
  onFormChange,
  groupOptions,
}: FormBinding & { readonly groupOptions: readonly MockGroup[] }) {
  return (
    <div>
      <label htmlFor="user-group" className={LABEL_CLASS}>
        Owning group
      </label>
      <select
        id="user-group"
        value={form.groupId}
        onChange={(e) => onFormChange({ ...form, groupId: e.target.value })}
        className={CONTROL_CLASS}
        disabled={form.role === "viewer" || groupOptions.length === 0}
      >
        {form.role === "viewer" && <option value="">No owning group</option>}
        {groupOptions.length === 0 && (
          <option value="">No active groups configured</option>
        )}
        {groupOptions.map((group) => (
          <option key={group.id} value={group.id}>
            {group.archived ? `${group.name} (archived)` : group.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function UserEditDialogFields({
  form,
  onFormChange,
  groupOptions,
  activeGroups,
  groups,
}: FormBinding & {
  readonly groupOptions: readonly MockGroup[];
  readonly activeGroups: readonly MockGroup[];
  readonly groups: readonly MockGroup[];
}) {
  return (
    <div className="mt-4 space-y-4">
      <IdentityFields form={form} onFormChange={onFormChange} />
      <RoleField
        form={form}
        onFormChange={onFormChange}
        activeGroups={activeGroups}
        groups={groups}
      />
      <GroupField
        form={form}
        onFormChange={onFormChange}
        groupOptions={groupOptions}
      />
    </div>
  );
}
