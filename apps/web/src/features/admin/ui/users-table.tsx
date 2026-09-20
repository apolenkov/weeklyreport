"use client";

import type { DbRole } from "@customreport/shared";
import { ROLE_LABEL, shortName } from "@customreport/shared";

import type { AdminUserView } from "../model/admin-types";
import { UserRowActions } from "./user-row-actions";

interface UsersTableProps {
  readonly users: readonly AdminUserView[];
  readonly deactivatePending: boolean;
  readonly activatePending: boolean;
  readonly onEdit: (user: AdminUserView) => void;
  readonly onDeactivate: (user: AdminUserView) => void;
  readonly onActivate: (user: AdminUserView) => void;
  readonly onDelete: (user: AdminUserView, trigger: HTMLButtonElement) => void;
}

const COLUMNS: readonly {
  readonly label: string;
  readonly alignRight: boolean;
}[] = [
  { label: "Name", alignRight: false },
  { label: "Email", alignRight: false },
  { label: "Role", alignRight: false },
  { label: "Group", alignRight: false },
  { label: "Position", alignRight: false },
  { label: "Actions", alignRight: true },
];

const ROLE_STYLES: Readonly<
  Record<DbRole, { readonly bg: string; readonly text: string }>
> = {
  lead: {
    bg: "var(--color-chip-on-track-bg)",
    text: "var(--color-chip-on-track-text)",
  },
  head: {
    bg: "var(--color-chip-at-risk-bg)",
    text: "var(--color-chip-at-risk-text)",
  },
  admin: {
    bg: "var(--color-chip-blocked-bg)",
    text: "var(--color-chip-blocked-text)",
  },
  viewer: { bg: "var(--color-muted)", text: "var(--color-muted-foreground)" },
};

export function UsersTable({
  users,
  deactivatePending,
  activatePending,
  onEdit,
  onDeactivate,
  onActivate,
  onDelete,
}: UsersTableProps) {
  return (
    <div className="relative overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
      <table className="w-full text-left text-sm" data-testid="users-table">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
            {COLUMNS.map(({ label, alignRight }) => (
              <th
                key={label}
                className={`px-4 py-3${alignRight ? " text-right" : ""} font-semibold text-[var(--color-foreground)]`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              deactivatePending={deactivatePending}
              activatePending={activatePending}
              onEdit={onEdit}
              onDeactivate={onDeactivate}
              onActivate={onActivate}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

type UserRowProps = Omit<UsersTableProps, "users"> & {
  readonly user: AdminUserView;
};

function UserRow({
  user,
  deactivatePending,
  activatePending,
  onEdit,
  onDeactivate,
  onActivate,
  onDelete,
}: UserRowProps) {
  return (
    <tr
      className={`border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)]${!user.isActive ? " opacity-60" : ""}`}
    >
      <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">
        <span className="flex items-center gap-2">
          {shortName(user)}
          {!user.isActive && (
            <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2 py-0.5 text-xs font-semibold text-[var(--color-muted-foreground)]">
              inactive
            </span>
          )}
        </span>
      </td>
      <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
        {user.email}
      </td>
      <td className="px-4 py-3">
        <RoleBadge role={user.role} />
      </td>
      <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
        {user.department}
      </td>
      <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
        {user.position ?? "—"}
      </td>
      <td className="px-4 py-3 text-right">
        <UserRowActions
          user={user}
          deactivatePending={deactivatePending}
          activatePending={activatePending}
          onEdit={onEdit}
          onDeactivate={onDeactivate}
          onActivate={onActivate}
          onDelete={onDelete}
        />
      </td>
    </tr>
  );
}

function RoleBadge({ role }: { readonly role: DbRole }) {
  const s = ROLE_STYLES[role];

  return (
    <span
      className="inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}
