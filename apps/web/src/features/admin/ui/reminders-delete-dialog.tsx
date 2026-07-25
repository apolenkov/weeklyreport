"use client";

import { ConfirmDeleteDialog } from "../../../shared/ui/confirm-delete-dialog";
import type { MockReminderPolicy } from "../model/admin-types";
import {
  describeRecipient,
  formatPolicyTiming,
  formatValidityWindow,
} from "../model/reminders-tab-format";

interface RemindersDeleteDialogProps {
  readonly policy: MockReminderPolicy | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * Reminders Delete Dialog.
 * @param props - The props argument.
 */
export function RemindersDeleteDialog({
  policy,
  onConfirm,
  onCancel,
}: RemindersDeleteDialogProps) {
  return (
    <ConfirmDeleteDialog
      open={policy !== null}
      title="Delete reminder?"
      preview={
        policy
          ? `${formatPolicyTiming(policy)} · ${describeRecipient(
              policy.audience,
            )}`
          : ""
      }
      subtitle={policy ? formatValidityWindow(policy) : undefined}
      consequence="This permanently deletes the reminder and its schedule. This cannot be undone."
      confirmLabel="Delete"
      reversible={false}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
