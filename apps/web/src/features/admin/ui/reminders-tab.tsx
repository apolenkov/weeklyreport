"use client";

import type {
  AdminReminderPolicyView,
  AdminReminderView,
} from "../model/admin-types";
import { PolicyForm } from "./policy-form";
import { RemindersDeleteDialog } from "./reminders-delete-dialog";
import { RemindersPolicyList } from "./reminders-policy-list";
import { RemindersTabHeader } from "./reminders-tab-header";
import { useRemindersTabState } from "./use-reminders-tab-state";

interface RemindersTabProps {
  readonly policies: readonly AdminReminderPolicyView[];
  // Derived rules feed each card's next-send line; legacy null-policy rules
  // remain hidden from this grouped view.
  readonly derivedRulesByPolicyId: Readonly<
    Record<string, readonly AdminReminderView[]>
  >;
  // New reminders are seeded with this organisation-wide timezone.
  readonly defaultTimezone: string;
}

export function RemindersTab({
  policies,
  derivedRulesByPolicyId,
  defaultTimezone,
}: RemindersTabProps) {
  const state = useRemindersTabState(policies, defaultTimezone);
  const editorProps = {
    form: state.form,
    isSaving: state.isSaving,
    validityValid: state.validityValid,
    onChange: state.setForm,
    onOffsetValidityChange: state.setOffsetValid,
    onCancel: state.closeEditor,
    onSave: state.handleSave,
  };

  return (
    <div className="space-y-4">
      <RemindersTabHeader
        policyCount={policies.length}
        search={state.search}
        onSearchChange={state.setSearch}
        onNewReminder={state.handleNewReminder}
      />

      {state.editor.mode === "add" && (
        <PolicyForm editing={false} {...editorProps} />
      )}

      <RemindersPolicyList
        policies={policies}
        filteredPolicies={state.filteredPolicies}
        derivedRulesByPolicyId={derivedRulesByPolicyId}
        editor={state.editor}
        editorProps={editorProps}
        busyId={state.busyId}
        now={state.now}
        onNewReminder={state.handleNewReminder}
        onToggleActive={state.handleToggleActive}
        onEdit={state.handleEditReminder}
        onRemove={state.setPendingDelete}
      />

      <RemindersDeleteDialog
        policy={state.pendingDelete}
        onConfirm={state.handleConfirmRemove}
        onCancel={() => state.setPendingDelete(null)}
      />
    </div>
  );
}
