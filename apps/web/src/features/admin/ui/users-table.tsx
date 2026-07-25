"use client";

import type { DbRole } from "@customreport/shared";
import { ROLE_LABEL, shortName } from "@customreport/shared";

import type { MockUser } from "../model/admin-types";
import { UserRowActions } from "./user-row-actions";

interface UsersTableProps {
  readonly users: readonly MockUser[];
  readonly deactivatePending: boolean;
  readonly activatePending: boolean;
  readonly onEdit: (user: MockUser) => void;
  readonly onDeactivate: (user: MockUser) => void;
  readonly onActivate: (user: MockUser) => void;
  readonly onDelete: (user: MockUser, trigger: HTMLButtonElement) => void;
}

/**
 * Users Table.
 * @param props - The props argument.
 */
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
    <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
      <table className="w-full text-left text-sm" data-testid="users-table">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
            <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
              Name
            </th>
            <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
              Email
            </th>
            <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
              Role
            </th>
            <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
              Group
            </th>
            <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
              Position
            </th>
            <th className="px-4 py-3 text-right font-semibold text-[var(--color-foreground)]">
              Actions
            </th>
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
  readonly user: MockUser;
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
            <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-500">
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
  const styles: Record<DbRole, { bg: string; text: string }> = {
    lead: { bg: "var(--color-success)", text: "var(--color-primary)" },
    head: {
      bg: "var(--color-status-in-progress-bg)",
      text: "var(--color-status-in-progress-fg)",
    },
    admin: {
      bg: "var(--color-status-at-risk-bg)",
      text: "var(--color-status-at-risk-fg)",
    },
    viewer: { bg: "var(--color-muted)", text: "var(--color-muted-foreground)" },
  };
  const s = styles[role];

  return (
    <span
      className="inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}
