"use client";

import { useEffect, useRef } from "react";

import type {
  AdminReminderExecutionView,
  AdminReminderPolicyView,
  AdminReminderView,
} from "../../model/admin-types";
import { PolicyForm } from "./policy-form";
import { ReminderExecutionList } from "./reminder-execution-list";
import { RemindersDeleteDialog } from "./reminders-delete-dialog";
import { RemindersPolicyList } from "./reminders-policy-list";
import { RemindersTabHeader } from "./reminders-tab-header";
import { useRemindersTabState } from "./use-reminders-tab-state";

interface RemindersTabProps {
  readonly policies: readonly AdminReminderPolicyView[];
  // Derived rules feed each card's next-send line.
  readonly derivedRulesByPolicyId: Readonly<
    Record<string, readonly AdminReminderView[]>
  >;
  readonly executions: readonly AdminReminderExecutionView[];
  // New reminders are seeded with this organisation-wide timezone.
  readonly defaultTimezone: string;
}

export function RemindersTab({
  policies,
  derivedRulesByPolicyId,
  executions,
  defaultTimezone,
}: RemindersTabProps) {
  const state = useRemindersTabState(policies, defaultTimezone);
  const previousEditor = useRef(state.editor);
  useEffect(() => {
    const wasOpen = previousEditor.current.mode !== "closed";
    if (wasOpen && state.editor.mode === "closed") {
      const testId =
        previousEditor.current.mode === "edit"
          ? `edit-${previousEditor.current.id}`
          : "new-policy-button";
      document
        .querySelector<HTMLElement>(`[data-testid="${CSS.escape(testId)}"]`)
        ?.focus();
    }
    previousEditor.current = state.editor;
  }, [state.editor]);
  const editorProps = {
    form: state.form,
    isSaving: state.isSaving,
    validityValid: state.validityValid,
    validityReason: state.validityReason,
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
        newReminderDisabled={state.editor.mode === "add" || state.isSaving}
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

      <ReminderExecutionList executions={executions} />

      <RemindersDeleteDialog
        policy={state.pendingDelete}
        onConfirm={state.handleConfirmRemove}
        onCancel={() => state.setPendingDelete(null)}
      />
    </div>
  );
}
