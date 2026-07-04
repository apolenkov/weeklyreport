"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { toReminderPolicyInput } from "../../lib/mappers";
import { pluralize } from "../../lib/pluralize";
import { ConfirmDeleteDialog } from "../lead/confirm-delete-dialog";
import type { MockReminder, MockReminderPolicy } from "./mock-data";
import { PlusIcon, PolicyForm } from "./policy-form";
import { PolicyRow } from "./policy-row";
import { RemindersEmptyState } from "./reminders-empty-state";
import {
  emptyPolicyForm,
  type PolicyFormState,
  policyToForm,
} from "./reminders-form-state";
import {
  describeRecipient,
  formatPolicyTiming,
  formatValidityWindow,
} from "./reminders-tab-format";
import {
  toggledPayload,
  useReminderPolicyMutations,
} from "./reminders-tab-mutations";
import { TabHeader, TabSearch } from "./tab-header";

/**
 * The inline editor is mutually exclusive: a new reminder renders at the top
 * of the list ("add"), and editing replaces a single card in place ("edit").
 */
type Editor =
  | { readonly mode: "closed" }
  | { readonly mode: "add" }
  | { readonly mode: "edit"; readonly id: string };

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
  /**
   * UFB-048 (Phase 48-B): organisation-wide timezone default for a new
   * reminder. Optional — older callers get the historical Europe/Moscow
   * default. The audience default no longer feeds the pairing (D7).
   */
  readonly defaultTimezone?: string;
}

export function RemindersTab({
  policies,
  derivedRulesByPolicyId,
  defaultTimezone,
}: RemindersTabProps) {
  const { saveMut, removeMut } = useReminderPolicyMutations();

  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<Editor>(() =>
    policies.length === 0 ? { mode: "add" } : { mode: "closed" },
  );
  const [form, setForm] = useState<PolicyFormState>(() =>
    emptyPolicyForm({ timezone: defaultTimezone }),
  );
  const [pendingDelete, setPendingDelete] = useState<MockReminderPolicy | null>(
    null,
  );
  // Id of the reminder whose own save/remove is in flight — so a mutation
  // disables only that row's controls, not the whole list.
  const [busyId, setBusyId] = useState<string | null>(null);

  // Captured once so the next-send line is stable across re-renders.
  const now = useMemo(() => new Date(), []);

  function resetForm() {
    setForm(emptyPolicyForm({ timezone: defaultTimezone }));
  }

  const validityValid = useMemo(() => {
    if (form.foreverChecked) return true;
    if (form.validUntilIso === null) return true;
    return form.validUntilIso >= form.validFromIso;
  }, [form.foreverChecked, form.validFromIso, form.validUntilIso]);

  function handleNewReminder() {
    resetForm();
    setEditor({ mode: "add" });
  }

  function handleEditReminder(policy: MockReminderPolicy) {
    setForm(policyToForm(policy));
    setEditor({ mode: "edit", id: policy.id });
  }

  function closeEditor() {
    setEditor({ mode: "closed" });
    resetForm();
  }

  function handleSave() {
    if (!validityValid) {
      toast.error("End date must be after start date");
      return;
    }
    const wasEditing = editor.mode === "edit";
    const payload = toReminderPolicyInput(
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
    saveMut.mutate(payload, {
      onSuccess: () => {
        toast.success(wasEditing ? "Reminder updated" : "Reminder created");
        closeEditor();
      },
    });
  }

  function handleToggleActive(policy: MockReminderPolicy) {
    setBusyId(policy.id);
    saveMut.mutate(toggledPayload(policy), {
      onSuccess: () => toast.success("Reminder updated"),
      onSettled: () => setBusyId(null),
    });
  }

  function handleConfirmRemove() {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    removeMut.mutate(
      { id: pendingDelete.id },
      { onSettled: () => setBusyId(null) },
    );
    setPendingDelete(null);
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredPolicies = useMemo(() => {
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
  }, [normalizedSearch, policies]);

  return (
    <div className="space-y-4">
      <TabHeader
        title="Reminders"
        description="Each reminder fires automatically before every report deadline inside its validity window."
        count={`${policies.length} ${pluralize(policies.length, "reminder", "reminders")}`}
        search={
          <TabSearch
            value={search}
            onChange={setSearch}
            placeholder="Search reminders…"
            testId="reminders-search"
            ariaLabel="Search reminders"
          />
        }
        actions={
          <button
            type="button"
            onClick={handleNewReminder}
            data-testid="new-policy-button"
            className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
          >
            <PlusIcon />
            New Reminder
          </button>
        }
      />

      {editor.mode === "add" && (
        <PolicyForm
          form={form}
          editing={false}
          isSaving={saveMut.isPending}
          validityValid={validityValid}
          onChange={setForm}
          onCancel={closeEditor}
          onSave={handleSave}
        />
      )}

      <div className="space-y-3">
        {filteredPolicies.length === 0 && (
          <RemindersEmptyState
            hasNoPolicies={policies.length === 0}
            onCreate={handleNewReminder}
          />
        )}

        {filteredPolicies.map((policy) =>
          editor.mode === "edit" && editor.id === policy.id ? (
            <PolicyForm
              key={policy.id}
              form={form}
              editing
              isSaving={saveMut.isPending}
              validityValid={validityValid}
              onChange={setForm}
              onCancel={closeEditor}
              onSave={handleSave}
            />
          ) : (
            <PolicyRow
              key={policy.id}
              policy={policy}
              derivedRules={derivedRulesByPolicyId[policy.id] ?? []}
              isBusy={busyId === policy.id}
              now={now}
              onToggleActive={() => handleToggleActive(policy)}
              onEdit={() => handleEditReminder(policy)}
              onRemove={() => setPendingDelete(policy)}
            />
          ),
        )}
      </div>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Delete reminder?"
        preview={
          pendingDelete
            ? `${formatPolicyTiming(pendingDelete)} · ${describeRecipient(
                pendingDelete.audience,
              )}`
            : ""
        }
        subtitle={
          pendingDelete ? formatValidityWindow(pendingDelete) : undefined
        }
        consequence="This permanently deletes the reminder and its schedule. This cannot be undone."
        confirmLabel="Delete"
        reversible={false}
        onConfirm={handleConfirmRemove}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
