"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { toReminderPolicyInput } from "../../model/admin";
import type { AdminReminderPolicyView } from "../../model/admin-types";
import {
  emptyPolicyForm,
  type PolicyFormState,
  policyToForm,
} from "../../model/reminders-form-state";
import {
  describeRecipient,
  formatPolicyTiming,
} from "../../model/reminders-tab-format";
import {
  toggledPayload,
  useReminderPolicyMutations,
} from "../../model/reminders-tab-mutations";

// The inline editor is mutually exclusive: add renders above the list, while
// edit replaces one card in place.
export type RemindersEditor =
  | { readonly mode: "closed" }
  | { readonly mode: "add" }
  | { readonly mode: "edit"; readonly id: string };

function filterPolicies(
  policies: readonly AdminReminderPolicyView[],
  normalizedSearch: string,
): readonly AdminReminderPolicyView[] {
  if (!normalizedSearch) return policies;
  return policies.filter((p) =>
    [
      formatPolicyTiming(p),
      describeRecipient(p.audience),
      p.active ? "active on" : "disabled off",
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch),
  );
}

function policyPayload(form: PolicyFormState, editor: RemindersEditor) {
  return toReminderPolicyInput(
    {
      kind: form.kind,
      offsetMinutes: form.offsetMinutes,
      timezone: form.timezone,
      audience: form.audience,
      active: form.active,
      validFromIso: form.validFromIso,
      validUntilIso: form.foreverChecked ? null : form.validUntilIso,
    },
    editor.mode === "edit" ? editor.id : undefined,
  );
}

function useReminderEditor(
  policies: readonly AdminReminderPolicyView[],
  defaultTimezone: string,
) {
  const [editor, setEditor] = useState<RemindersEditor>(() =>
    policies.length === 0 ? { mode: "add" } : { mode: "closed" },
  );
  const [form, setForm] = useState<PolicyFormState>(() =>
    emptyPolicyForm(defaultTimezone),
  );
  // Offset magnitude validity reported up from the form; an empty/malformed
  // keystroke keeps the raw text and blocks Save until a valid value is entered.
  const [offsetValid, setOffsetValid] = useState(true);
  const validityValid = useMemo(() => {
    if (!offsetValid) return false;
    if (form.foreverChecked) return true;
    if (form.validUntilIso === null) return true;
    return form.validUntilIso >= form.validFromIso;
  }, [form.foreverChecked, form.validFromIso, form.validUntilIso, offsetValid]);

  return {
    editor,
    form,
    setForm,
    validityValid,
    setOffsetValid,
    closeEditor: () => {
      setEditor({ mode: "closed" });
      setForm(emptyPolicyForm(defaultTimezone));
      setOffsetValid(true);
    },
    handleNewReminder: () => {
      if (editor.mode === "add") return;
      setForm(emptyPolicyForm(defaultTimezone));
      setOffsetValid(true);
      setEditor({ mode: "add" });
    },
    handleEditReminder: (policy: AdminReminderPolicyView) => {
      setForm(policyToForm(policy));
      setOffsetValid(true);
      setEditor({ mode: "edit", id: policy.id });
    },
  };
}

function useRemindersListState(policies: readonly AdminReminderPolicyView[]) {
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] =
    useState<AdminReminderPolicyView | null>(null);
  // Id of the reminder whose own save/remove is in flight — so a mutation
  // disables only that row's controls, not the whole list.
  const [busyId, setBusyId] = useState<string | null>(null);
  // Captured once so the next-send line is stable across re-renders.
  const now = useMemo(() => new Date(), []);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredPolicies = useMemo(
    () => filterPolicies(policies, normalizedSearch),
    [normalizedSearch, policies],
  );

  return {
    search,
    setSearch,
    pendingDelete,
    setPendingDelete,
    busyId,
    setBusyId,
    now,
    filteredPolicies,
  };
}

export function useRemindersTabState(
  policies: readonly AdminReminderPolicyView[],
  defaultTimezone: string,
) {
  const editorState = useReminderEditor(policies, defaultTimezone);
  const listState = useRemindersListState(policies);
  const { editorSaveMut, toggleMut, removeMut } = useReminderPolicyMutations();

  return {
    ...editorState,
    ...listState,
    isSaving: editorSaveMut.isPending,
    handleNewReminder: () => {
      if (editorSaveMut.isPending) return;
      editorState.handleNewReminder();
    },
    handleEditReminder: (policy: AdminReminderPolicyView) => {
      if (editorSaveMut.isPending) return;
      editorState.handleEditReminder(policy);
    },
    handleSave: () => {
      if (!editorState.validityValid) {
        toast.error("End date must be after start date");
        return;
      }
      const wasEditing = editorState.editor.mode === "edit";
      editorSaveMut.mutate(
        policyPayload(editorState.form, editorState.editor),
        {
          onSuccess: () => {
            toast.success(wasEditing ? "Reminder updated" : "Reminder created");
            editorState.closeEditor();
          },
        },
      );
    },
    handleToggleActive: (policy: AdminReminderPolicyView) => {
      listState.setBusyId(policy.id);
      toggleMut.mutate(toggledPayload(policy), {
        onSuccess: () => toast.success("Reminder updated"),
        onSettled: () => listState.setBusyId(null),
      });
    },
    handleConfirmRemove: () => {
      const target = listState.pendingDelete;
      if (!target) return;
      listState.setBusyId(target.id);
      removeMut.mutate(
        { id: target.id },
        { onSettled: () => listState.setBusyId(null) },
      );
      listState.setPendingDelete(null);
    },
  };
}
