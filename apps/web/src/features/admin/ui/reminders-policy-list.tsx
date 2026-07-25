"use client";

import type { MockReminder, MockReminderPolicy } from "../model/admin-types";
import type { PolicyFormState } from "../model/reminders-form-state";
import { PolicyForm } from "./policy-form";
import { PolicyRow } from "./policy-row";
import { RemindersEmptyState } from "./reminders-empty-state";
import type { RemindersEditor } from "./use-reminders-tab-state";

// The add-form and the in-place edit-form are the same editor bound to the same
// draft, so both receive one prop bundle and differ only in `editing`.
interface PolicyEditorProps {
  readonly form: PolicyFormState;
  readonly isSaving: boolean;
  readonly validityValid: boolean;
  readonly onChange: (
    next: PolicyFormState | ((prev: PolicyFormState) => PolicyFormState),
  ) => void;
  readonly onCancel: () => void;
  readonly onSave: () => void;
}

interface RemindersPolicyListProps {
  readonly policies: readonly MockReminderPolicy[];
  readonly filteredPolicies: readonly MockReminderPolicy[];
  readonly derivedRulesByPolicyId: Readonly<
    Record<string, readonly MockReminder[]>
  >;
  readonly editor: RemindersEditor;
  readonly editorProps: PolicyEditorProps;
  readonly busyId: string | null;
  readonly now: Date;
  readonly onNewReminder: () => void;
  readonly onToggleActive: (policy: MockReminderPolicy) => void;
  readonly onEdit: (policy: MockReminderPolicy) => void;
  readonly onRemove: (policy: MockReminderPolicy) => void;
}

/**
 * Reminders Policy List.
 * @param props - The props argument.
 */
export function RemindersPolicyList({
  policies,
  filteredPolicies,
  derivedRulesByPolicyId,
  editor,
  editorProps,
  busyId,
  now,
  onNewReminder,
  onToggleActive,
  onEdit,
  onRemove,
}: RemindersPolicyListProps) {
  return (
    <div className="space-y-3">
      {filteredPolicies.length === 0 &&
        (policies.length > 0 || editor.mode !== "add") && (
          <RemindersEmptyState
            hasNoPolicies={policies.length === 0}
            onCreate={onNewReminder}
          />
        )}

      {filteredPolicies.map((policy) =>
        editor.mode === "edit" && editor.id === policy.id ? (
          <PolicyForm key={policy.id} editing {...editorProps} />
        ) : (
          <PolicyRow
            key={policy.id}
            policy={policy}
            derivedRules={derivedRulesByPolicyId[policy.id] ?? []}
            isBusy={busyId === policy.id}
            now={now}
            onToggleActive={() => onToggleActive(policy)}
            onEdit={() => onEdit(policy)}
            onRemove={() => onRemove(policy)}
          />
        ),
      )}
    </div>
  );
}
