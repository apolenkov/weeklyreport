"use client";

import type {
  AdminReminderPolicyView,
  AdminReminderView,
} from "../../model/admin-types";
import type { PolicyFormState } from "../../model/reminders-form-state";
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
  readonly onOffsetValidityChange: (valid: boolean) => void;
  readonly onCancel: () => void;
  readonly onSave: () => void;
}

interface RemindersPolicyListProps {
  readonly policies: readonly AdminReminderPolicyView[];
  readonly filteredPolicies: readonly AdminReminderPolicyView[];
  readonly derivedRulesByPolicyId: Readonly<
    Record<string, readonly AdminReminderView[]>
  >;
  readonly editor: RemindersEditor;
  readonly editorProps: PolicyEditorProps;
  readonly busyId: string | null;
  readonly now: Date;
  readonly onNewReminder: () => void;
  readonly onToggleActive: (policy: AdminReminderPolicyView) => void;
  readonly onEdit: (policy: AdminReminderPolicyView) => void;
  readonly onRemove: (policy: AdminReminderPolicyView) => void;
}

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
