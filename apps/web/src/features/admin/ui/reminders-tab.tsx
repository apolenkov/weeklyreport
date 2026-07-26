"use client";

import type { MockReminder, MockReminderPolicy } from "../model/admin-types";
import { PolicyForm } from "./policy-form";
import { RemindersDeleteDialog } from "./reminders-delete-dialog";
import { RemindersPolicyList } from "./reminders-policy-list";
import { RemindersTabHeader } from "./reminders-tab-header";
import { useRemindersTabState } from "./use-reminders-tab-state";

interface RemindersTabProps {
  readonly policies: readonly MockReminderPolicy[];
  /**
   * Read-only derived rules grouped by `policyId`, used only to compute each
   * card's next-send line. Rules whose `policyId` is `null` (legacy) are not
   * surfaced here.
   */
  readonly derivedRulesByPolicyId: Readonly<
    Record<string, readonly MockReminder[]>
  >;
  /** Organisation-wide timezone required to seed a new reminder. */
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
