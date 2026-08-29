"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@customreport/ui/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { useRef } from "react";

import type { AdminUserView } from "../model/admin-types";

interface UserRowActionsProps {
  readonly user: AdminUserView;
  readonly deactivatePending: boolean;
  readonly activatePending: boolean;
  readonly onEdit: (user: AdminUserView) => void;
  readonly onDeactivate: (user: AdminUserView) => void;
  readonly onActivate: (user: AdminUserView) => void;
  readonly onDelete: (user: AdminUserView, trigger: HTMLButtonElement) => void;
}

const ROUTINE_ACTION_CLASS =
  "btn-press inline-flex h-10 max-md:min-h-[var(--touch-target-min)] max-md:min-w-[var(--touch-target-min)] min-w-10 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--card-surface-border)] bg-[var(--color-card)] px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

function UserActivationButton(
  props: Pick<
    UserRowActionsProps,
    | "user"
    | "deactivatePending"
    | "activatePending"
    | "onDeactivate"
    | "onActivate"
  >,
) {
  const activation = props.user.isActive
    ? {
        label: "Deactivate",
        pending: props.deactivatePending,
        action: props.onDeactivate,
        className:
          "text-[var(--color-status-at-risk-fg)] hover:border-[var(--color-status-at-risk-border)] hover:bg-[var(--color-status-at-risk-bg)]",
      }
    : {
        label: "Activate",
        pending: props.activatePending,
        action: props.onActivate,
        className:
          "text-[var(--color-starbucks-accent)] hover:border-[var(--color-border-accent-hover)] hover:bg-[var(--color-success)]",
      };
  return (
    <button
      type="button"
      onClick={() => activation.action(props.user)}
      disabled={activation.pending}
      className={`${ROUTINE_ACTION_CLASS} ${activation.className}`}
      aria-label={`${activation.label} ${props.user.name}`}
    >
      {activation.label}
    </button>
  );
}

function UserOverflowMenu({
  user,
  onDelete,
}: Pick<UserRowActionsProps, "user" | "onDelete">) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className={`${ROUTINE_ACTION_CLASS} px-0 text-[var(--color-muted-foreground)] hover:border-[var(--color-border-accent-hover)] hover:text-[var(--color-foreground)]`}
          aria-label={`More actions for ${user.name}`}
        >
          <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
          <span className="sr-only">User actions</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        aria-label="User actions"
        className="min-w-44"
      >
        <DropdownMenuItem
          variant="destructive"
          className="min-h-10 max-md:min-h-[var(--touch-target-min)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          onSelect={() => {
            const trigger = triggerRef.current;
            if (trigger) onDelete(user, trigger);
          }}
        >
          <Trash2 aria-hidden="true" />
          Delete user
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserRowActions({
  user,
  deactivatePending,
  activatePending,
  onEdit,
  onDeactivate,
  onActivate,
  onDelete,
}: UserRowActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => onEdit(user)}
        className={`${ROUTINE_ACTION_CLASS} text-[var(--color-starbucks-accent)] hover:border-[var(--color-border-accent-hover)] hover:bg-[var(--color-success)]`}
        aria-label={`Edit ${user.name}`}
      >
        Edit
      </button>
      <UserActivationButton
        user={user}
        deactivatePending={deactivatePending}
        activatePending={activatePending}
        onDeactivate={onDeactivate}
        onActivate={onActivate}
      />
      <UserOverflowMenu user={user} onDelete={onDelete} />
    </div>
  );
}
