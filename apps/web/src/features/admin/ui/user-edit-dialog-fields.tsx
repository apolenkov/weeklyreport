"use client";

import { type DbRole, ROLE_LABEL } from "@customreport/shared";
import { type FocusEventHandler, type SyntheticEvent, useState } from "react";

import type { AdminGroupView } from "../model/admin-types";
import type { UserFormData } from "../model/user-form";

const LABEL_CLASS =
  "mb-1 block text-sm font-medium text-[var(--color-foreground)]";

const CONTROL_CLASS =
  "w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]";

interface FormBinding {
  readonly form: UserFormData;
  readonly onFormChange: (form: UserFormData) => void;
}

function TextField({
  id,
  label,
  type = "text",
  name,
  autoComplete,
  required,
  value,
  onChange,
  onBlur,
  onInvalid,
  error,
}: {
  readonly id: string;
  readonly label: string;
  readonly type?: "text" | "email";
  readonly name: string;
  readonly autoComplete: string;
  readonly required?: boolean;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onBlur?: FocusEventHandler<HTMLInputElement>;
  readonly onInvalid?: (event: SyntheticEvent<HTMLInputElement>) => void;
  readonly error?: string | undefined;
}) {
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        name={name}
        autoComplete={autoComplete}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onInvalid={onInvalid}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        spellCheck={type === "email" ? false : undefined}
        className={CONTROL_CLASS}
      />
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1 text-xs text-[var(--color-destructive)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function IdentityFields({ form, onFormChange }: FormBinding) {
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const validateEmail = (event: { currentTarget: HTMLInputElement }) => {
    const { validity } = event.currentTarget;
    setEmailError(
      validity.valid
        ? undefined
        : validity.valueMissing
          ? "Email is required."
          : "Enter a valid email address.",
    );
  };

  return (
    <>
      <TextField
        id="user-last-name"
        label="Last name"
        name="lastName"
        autoComplete="family-name"
        required
        value={form.lastName}
        onChange={(lastName) => onFormChange({ ...form, lastName })}
      />
      <TextField
        id="user-first-name"
        label="First name"
        name="firstName"
        autoComplete="given-name"
        required
        value={form.firstName}
        onChange={(firstName) => onFormChange({ ...form, firstName })}
      />
      <TextField
        id="user-middle-name"
        label="Middle name"
        name="middleName"
        autoComplete="additional-name"
        value={form.middleName}
        onChange={(middleName) => onFormChange({ ...form, middleName })}
      />
      <TextField
        id="user-position"
        label="Position"
        name="position"
        autoComplete="organization-title"
        value={form.position}
        onChange={(position) => onFormChange({ ...form, position })}
      />
      <TextField
        id="user-email"
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        required
        value={form.email}
        onChange={(email) => onFormChange({ ...form, email })}
        onBlur={validateEmail}
        onInvalid={validateEmail}
        error={emailError}
      />
    </>
  );
}

// A viewer owns no group; any other role keeps its group or falls back to the
// first configured one, so the form never submits an unowned non-viewer.
function withRole(
  form: UserFormData,
  role: DbRole,
  activeGroups: readonly AdminGroupView[],
  groups: readonly AdminGroupView[],
): UserFormData {
  return {
    ...form,
    role,
    groupId:
      role === "viewer"
        ? null
        : (form.groupId ?? activeGroups[0]?.id ?? groups[0]?.id ?? null),
  };
}

function RoleField({
  form,
  onFormChange,
  activeGroups,
  groups,
}: FormBinding & {
  readonly activeGroups: readonly AdminGroupView[];
  readonly groups: readonly AdminGroupView[];
}) {
  return (
    <div>
      <label htmlFor="user-role" className={LABEL_CLASS}>
        Role
      </label>
      <select
        id="user-role"
        name="role"
        autoComplete="off"
        value={form.role}
        onChange={(e) =>
          onFormChange(
            withRole(form, e.target.value as DbRole, activeGroups, groups),
          )
        }
        className={CONTROL_CLASS}
      >
        <option value="lead">{ROLE_LABEL.lead}</option>
        <option value="head">{ROLE_LABEL.head}</option>
        <option value="admin">{ROLE_LABEL.admin}</option>
        <option value="viewer">{ROLE_LABEL.viewer}</option>
      </select>
    </div>
  );
}

function GroupField({
  form,
  onFormChange,
  groupOptions,
}: FormBinding & { readonly groupOptions: readonly AdminGroupView[] }) {
  return (
    <div>
      <label htmlFor="user-group" className={LABEL_CLASS}>
        Owning group
      </label>
      <select
        id="user-group"
        name="groupId"
        autoComplete="off"
        required={form.role !== "viewer" && groupOptions.length > 0}
        value={form.groupId ?? ""}
        onChange={(e) => onFormChange({ ...form, groupId: e.target.value })}
        className={CONTROL_CLASS}
        disabled={form.role === "viewer" || groupOptions.length <= 1}
      >
        {form.role === "viewer" && <option value="">No owning group</option>}
        {form.groupId === null && form.role !== "viewer" && (
          <option value="" disabled>
            Select group…
          </option>
        )}
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
  readonly groupOptions: readonly AdminGroupView[];
  readonly activeGroups: readonly AdminGroupView[];
  readonly groups: readonly AdminGroupView[];
}) {
  return (
    <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
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
