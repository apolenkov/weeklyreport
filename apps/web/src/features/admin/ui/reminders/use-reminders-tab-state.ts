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
  // One reason explains why Save is blocked; null means the draft is valid.
  // The same copy feeds the footer hint and the defensive handleSave toast.
  const validityReason = useMemo((): string | null => {
    if (!offsetValid) return "Enter a valid reminder offset";
    // A clearable date input yields an empty string; it must block Save even
    // when the forever checkbox or an absent end date would otherwise pass.
    if (form.validFromIso === "") return "Start date is required";
    if (form.foreverChecked || form.validUntilIso === null) return null;
    if (form.validUntilIso === "") return "End date is required";
    // ISO date strings compare lexicographically; the window is inclusive.
    return form.validUntilIso < form.validFromIso
      ? "End date must be on or after start date"
      : null;
  }, [form.foreverChecked, form.validFromIso, form.validUntilIso, offsetValid]);
  const validityValid = validityReason === null;

  return {
    editor,
    form,
    setForm,
    validityValid,
    validityReason,
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
  // Ids of reminders whose own save/remove is in flight — so each mutation
  // disables only that row's controls, not the whole list. A set, not a
  // single id: overlapping row toggles must not free a row that is still
  // pending nor clear a sibling's busy state on settle.
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  // Captured per render: a mount-only memo would keep showing a fireAt that
  // already passed as "upcoming" for as long as the tab stays open.
  const now = new Date();

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
    busyIds,
    setBusyIds,
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
      // Defensive gate behind the disabled button: surfaces the same reason
      // the footer hint shows instead of a generic validity message.
      const reason = editorState.validityReason;
      if (reason !== null) {
        toast.error(reason);
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
      listState.setBusyIds((previous) => new Set(previous).add(policy.id));
      toggleMut.mutate(toggledPayload(policy), {
        onSuccess: () => toast.success("Reminder updated"),
        onSettled: () =>
          listState.setBusyIds((previous) => {
            const next = new Set(previous);
            next.delete(policy.id);
            return next;
          }),
      });
    },
    handleConfirmRemove: () => {
      const target = listState.pendingDelete;
      if (!target) return;
      listState.setBusyIds((previous) => new Set(previous).add(target.id));
      removeMut.mutate(
        { id: target.id },
        {
          onSettled: () =>
            listState.setBusyIds((previous) => {
              const next = new Set(previous);
              next.delete(target.id);
              return next;
            }),
        },
      );
      listState.setPendingDelete(null);
    },
  };
}
